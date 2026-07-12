import { randomUUID } from "node:crypto";

import {
  getFirstRow,
  getRows,
  type Database,
  readDatabase,
  writeDatabase
} from "@/lib/database";
import { purgeKnowledgeTableAttachments } from "@/lib/knowledge-attachments";
import { ensureKnowledgeCollaborationSchema } from "@/lib/knowledge-collaboration-schema";
import { ensureKnowledgeTrashSchema } from "@/lib/knowledge-trash-schema";
import type { KnowledgeActor } from "@/lib/knowledge-workspace";
import { KnowledgeValidationError, requiredRevision } from "@/lib/knowledge-validation";

export type KnowledgeTrashResourceType = "page" | "table";

export type KnowledgeTrashItem = {
  deletedAt: string;
  deletedByAccount?: string;
  deletedById?: string;
  descendantCount?: number;
  id: string;
  parentId?: string;
  resourceType: KnowledgeTrashResourceType;
  revision: number;
  spaceId: string;
  title: string;
};

type PageTrashRow = {
  deleted_at: string;
  deleted_by_account: string | null;
  deleted_by_id: string | null;
  deletion_batch_id: string;
  id: string;
  parent_id: string | null;
  revision: number;
  space_id: string;
  title: string;
};

type TableTrashRow = {
  deleted_at: string;
  deleted_by_account: string | null;
  deleted_by_id: string | null;
  deletion_batch_id: string;
  id: string;
  revision: number;
  space_id: string;
  title: string;
};

function notFound(resource: string): never {
  throw new KnowledgeValidationError("RESOURCE_NOT_FOUND", `${resource}不存在。`, 404);
}

function conflict(resource: string): never {
  throw new KnowledgeValidationError(
    "REVISION_CONFLICT",
    `${resource}已被其他人更新，请刷新后重试。`,
    409
  );
}

async function ensureTrashSchemas() {
  await ensureKnowledgeCollaborationSchema();
  await ensureKnowledgeTrashSchema();
}

async function lockSpace(db: Database, spaceId: string) {
  const row = await getFirstRow<{ id: string }>(
    db,
    "SELECT id FROM knowledge_spaces WHERE id = ? FOR UPDATE",
    [spaceId]
  );
  if (!row) notFound("知识空间");
}

function mapPageTrash(row: PageTrashRow, descendantCount?: number): KnowledgeTrashItem {
  return {
    deletedAt: row.deleted_at,
    deletedByAccount: row.deleted_by_account ?? undefined,
    deletedById: row.deleted_by_id ?? undefined,
    descendantCount,
    id: row.id,
    parentId: row.parent_id ?? undefined,
    resourceType: "page",
    revision: Number(row.revision),
    spaceId: row.space_id,
    title: row.title
  };
}

function mapTableTrash(row: TableTrashRow): KnowledgeTrashItem {
  return {
    deletedAt: row.deleted_at,
    deletedByAccount: row.deleted_by_account ?? undefined,
    deletedById: row.deleted_by_id ?? undefined,
    id: row.id,
    resourceType: "table",
    revision: Number(row.revision),
    spaceId: row.space_id,
    title: row.title
  };
}

function collectDescendants(
  pages: Array<{ id: string; parent_id: string | null }>,
  rootId: string
) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const page of pages) {
      if (page.parent_id && ids.has(page.parent_id) && !ids.has(page.id)) {
        ids.add(page.id);
        changed = true;
      }
    }
  }
  return ids;
}

export async function moveKnowledgePageToTrash(
  spaceId: string,
  pageId: string,
  revisionValue: number,
  actor: KnowledgeActor
) {
  await ensureTrashSchemas();
  const revision = requiredRevision(revisionValue);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const root = await getFirstRow<{
      id: string;
      parent_id: string | null;
      revision: number;
      title: string;
    }>(
      db,
      `SELECT id, parent_id, revision, title FROM knowledge_pages
       WHERE id = ? AND space_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [pageId, spaceId]
    );
    if (!root) notFound("页面");
    if (Number(root.revision) !== revision) conflict("页面");
    const pages = await getRows<{ id: string; parent_id: string | null }>(
      db,
      `SELECT id, parent_id FROM knowledge_pages
       WHERE space_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [spaceId]
    );
    const ids = collectDescendants(pages, pageId);
    const batchId = randomUUID();
    const now = new Date().toISOString();
    for (const id of ids) {
      await db.execute(
        `UPDATE knowledge_pages SET deleted_at = ?, deleted_by_id = ?,
         deleted_by_account = ?, deletion_batch_id = ?, deleted_root_id = ?,
         revision = revision + 1, updated_at = ?
         WHERE id = ? AND space_id = ? AND deleted_at IS NULL`,
        [now, actor.id, actor.account ?? null, batchId, pageId, now, id, spaceId]
      );
    }
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    return {
      deletedAt: now,
      deletedByAccount: actor.account,
      deletedById: actor.id,
      descendantCount: Math.max(0, ids.size - 1),
      id: pageId,
      parentId: root.parent_id ?? undefined,
      resourceType: "page" as const,
      revision: revision + 1,
      spaceId,
      title: root.title
    };
  });
}

export async function moveKnowledgeTableToTrash(
  spaceId: string,
  tableId: string,
  revisionValue: number,
  actor: KnowledgeActor
) {
  await ensureTrashSchemas();
  const revision = requiredRevision(revisionValue);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const table = await getFirstRow<{ revision: number; title: string }>(
      db,
      `SELECT revision, title FROM knowledge_tables
       WHERE id = ? AND space_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [tableId, spaceId]
    );
    if (!table) notFound("多维表格");
    if (Number(table.revision) !== revision) conflict("多维表格");
    const batchId = randomUUID();
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_tables SET deleted_at = ?, deleted_by_id = ?,
       deleted_by_account = ?, deletion_batch_id = ?, deleted_root_id = ?,
       revision = revision + 1, updated_at = ?
       WHERE id = ? AND space_id = ? AND deleted_at IS NULL AND revision = ?`,
      [now, actor.id, actor.account ?? null, batchId, tableId, now, tableId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("多维表格");
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    return {
      deletedAt: now,
      deletedByAccount: actor.account,
      deletedById: actor.id,
      id: tableId,
      resourceType: "table" as const,
      revision: revision + 1,
      spaceId,
      title: table.title
    };
  });
}

export async function listKnowledgeTrash(spaceId: string) {
  await ensureTrashSchemas();
  return readDatabase(async (db) => {
    const [pages, tables] = await Promise.all([
      getRows<PageTrashRow>(
        db,
        `SELECT id, space_id, parent_id, title, revision, deleted_at,
          deleted_by_id, deleted_by_account, deletion_batch_id
         FROM knowledge_pages
         WHERE space_id = ? AND deleted_at IS NOT NULL AND deleted_root_id = id
         ORDER BY deleted_at DESC`,
        [spaceId]
      ),
      getRows<TableTrashRow>(
        db,
        `SELECT id, space_id, title, revision, deleted_at, deleted_by_id,
          deleted_by_account, deletion_batch_id
         FROM knowledge_tables
         WHERE space_id = ? AND deleted_at IS NOT NULL AND deleted_root_id = id
         ORDER BY deleted_at DESC`,
        [spaceId]
      )
    ]);
    const pageItems = await Promise.all(
      pages.map(async (page) => {
        const count = await getFirstRow<{ total: number }>(
          db,
          `SELECT COUNT(*) AS total FROM knowledge_pages
           WHERE space_id = ? AND deletion_batch_id = ?`,
          [spaceId, page.deletion_batch_id]
        );
        return mapPageTrash(page, Math.max(0, Number(count?.total ?? 1) - 1));
      })
    );
    return [...pageItems, ...tables.map(mapTableTrash)].sort((left, right) =>
      right.deletedAt.localeCompare(left.deletedAt)
    );
  });
}

export async function restoreKnowledgeTrashItem(
  spaceId: string,
  resourceType: KnowledgeTrashResourceType,
  resourceId: string,
  revisionValue: number
) {
  await ensureTrashSchemas();
  const revision = requiredRevision(revisionValue);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const now = new Date().toISOString();
    if (resourceType === "page") {
      const root = await getFirstRow<PageTrashRow>(
        db,
        `SELECT id, space_id, parent_id, title, revision, deleted_at,
          deleted_by_id, deleted_by_account, deletion_batch_id
         FROM knowledge_pages
         WHERE id = ? AND space_id = ? AND deleted_at IS NOT NULL
           AND deleted_root_id = id FOR UPDATE`,
        [resourceId, spaceId]
      );
      if (!root) notFound("回收站页面");
      if (Number(root.revision) !== revision) conflict("回收站页面");
      let parentId = root.parent_id;
      if (parentId) {
        const parent = await getFirstRow<{ id: string }>(
          db,
          `SELECT id FROM knowledge_pages
           WHERE id = ? AND space_id = ? AND deleted_at IS NULL`,
          [parentId, spaceId]
        );
        if (!parent) parentId = null;
      }
      await db.execute(
        `UPDATE knowledge_pages SET deleted_at = NULL, deleted_by_id = NULL,
         deleted_by_account = NULL, deletion_batch_id = NULL, deleted_root_id = NULL,
         revision = revision + 1, updated_at = ?
         WHERE space_id = ? AND deletion_batch_id = ?`,
        [now, spaceId, root.deletion_batch_id]
      );
      if (parentId !== root.parent_id) {
        await db.execute(
          "UPDATE knowledge_pages SET parent_id = ? WHERE id = ? AND space_id = ?",
          [parentId, resourceId, spaceId]
        );
      }
      await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
      return {
        ...mapPageTrash(root),
        parentId: parentId ?? undefined,
        restored: true,
        revision: revision + 1
      };
    }

    const table = await getFirstRow<TableTrashRow>(
      db,
      `SELECT id, space_id, title, revision, deleted_at, deleted_by_id,
        deleted_by_account, deletion_batch_id
       FROM knowledge_tables
       WHERE id = ? AND space_id = ? AND deleted_at IS NOT NULL
         AND deleted_root_id = id FOR UPDATE`,
      [resourceId, spaceId]
    );
    if (!table) notFound("回收站多维表格");
    if (Number(table.revision) !== revision) conflict("回收站多维表格");
    const result = await db.execute(
      `UPDATE knowledge_tables SET deleted_at = NULL, deleted_by_id = NULL,
       deleted_by_account = NULL, deletion_batch_id = NULL, deleted_root_id = NULL,
       revision = revision + 1, updated_at = ?
       WHERE id = ? AND space_id = ? AND revision = ?`,
      [now, resourceId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("回收站多维表格");
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    return { ...mapTableTrash(table), restored: true, revision: revision + 1 };
  });
}

async function permanentlyDeletePageWithDatabase(
  db: Database,
  spaceId: string,
  pageId: string
) {
  const pages = await getRows<{ id: string; parent_id: string | null }>(
    db,
    "SELECT id, parent_id FROM knowledge_pages WHERE space_id = ? FOR UPDATE",
    [spaceId]
  );
  const ids = collectDescendants(pages, pageId);
  for (const id of ids) {
    await db.execute(
      "DELETE FROM knowledge_page_comments WHERE page_id = ? AND space_id = ?",
      [id, spaceId]
    );
    await db.execute(
      "DELETE FROM knowledge_page_versions WHERE page_id = ? AND space_id = ?",
      [id, spaceId]
    );
  }
  // Delete children before their parents even though no foreign keys currently
  // enforce the hierarchy. This keeps the operation safe if constraints are
  // added later.
  for (const id of [...ids].reverse()) {
    await db.execute("DELETE FROM knowledge_pages WHERE id = ? AND space_id = ?", [id, spaceId]);
  }
  return ids.size;
}

async function permanentlyDeleteTableWithDatabase(
  db: Database,
  spaceId: string,
  tableId: string,
  revision: number
) {
  await db.execute("DELETE FROM knowledge_automation_runs WHERE table_id = ?", [tableId]);
  await db.execute("DELETE FROM knowledge_automation_rules WHERE table_id = ?", [tableId]);
  await db.execute("DELETE FROM knowledge_record_comments WHERE table_id = ?", [tableId]);
  await db.execute("DELETE FROM knowledge_record_activities WHERE table_id = ?", [tableId]);
  await db.execute("DELETE FROM knowledge_views WHERE table_id = ?", [tableId]);
  await db.execute("DELETE FROM knowledge_records WHERE table_id = ?", [tableId]);
  await db.execute("DELETE FROM knowledge_fields WHERE table_id = ?", [tableId]);
  const result = await db.execute(
    `DELETE FROM knowledge_tables
     WHERE id = ? AND space_id = ? AND deleted_at IS NOT NULL AND revision = ?`,
    [tableId, spaceId, revision]
  );
  if (!result.affectedRows) conflict("回收站多维表格");
}

export async function permanentlyDeleteKnowledgeTrashItem(
  spaceId: string,
  resourceType: KnowledgeTrashResourceType,
  resourceId: string,
  revisionValue: number
) {
  await ensureTrashSchemas();
  const revision = requiredRevision(revisionValue);
  const result = await writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    if (resourceType === "page") {
      const root = await getFirstRow<{ revision: number }>(
        db,
        `SELECT revision FROM knowledge_pages
         WHERE id = ? AND space_id = ? AND deleted_at IS NOT NULL
           AND deleted_root_id = id FOR UPDATE`,
        [resourceId, spaceId]
      );
      if (!root) notFound("回收站页面");
      if (Number(root.revision) !== revision) conflict("回收站页面");
      const deletedCount = await permanentlyDeletePageWithDatabase(db, spaceId, resourceId);
      await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [new Date().toISOString(), spaceId]);
      return { deletedCount, resourceType };
    }

    const table = await getFirstRow<{ revision: number }>(
      db,
      `SELECT revision FROM knowledge_tables
       WHERE id = ? AND space_id = ? AND deleted_at IS NOT NULL
         AND deleted_root_id = id FOR UPDATE`,
      [resourceId, spaceId]
    );
    if (!table) notFound("回收站多维表格");
    if (Number(table.revision) !== revision) conflict("回收站多维表格");
    await permanentlyDeleteTableWithDatabase(db, spaceId, resourceId, revision);
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [new Date().toISOString(), spaceId]);
    return { deletedCount: 1, resourceType };
  });
  if (resourceType === "table") {
    await purgeKnowledgeTableAttachments(resourceId).catch((error) => {
      console.error("Failed to purge permanently deleted table attachments", error);
    });
  }
  return result;
}
