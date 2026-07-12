import { randomUUID } from "node:crypto";

import {
  defaultProjectTypes,
  type ProjectType,
  type ProjectTypeSeed
} from "@/content/project-types";
import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase,
  type Database
} from "@/lib/database";

type ProjectTypeRow = {
  active: number;
  category: string;
  created_at: string;
  description: string;
  id: string;
  label: string;
  slug: string;
  sort_order: number;
  updated_at: string;
};

export type UpsertProjectTypeInput = {
  active?: boolean;
  category?: string;
  description?: string;
  id?: string;
  label?: string;
  sortOrder?: number;
};

let seedPromise: Promise<void> | null = null;

function allowDatabaseFallback() {
  return process.env.WCU_ALLOW_DATABASE_FALLBACK === "true";
}

function mapProjectType(row: ProjectTypeRow): ProjectType {
  return {
    active: Boolean(row.active),
    category: row.category,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    label: row.label,
    slug: row.slug,
    sortOrder: Number(row.sort_order),
    updatedAt: row.updated_at
  };
}

function defaultProjectTypeRows() {
  const now = new Date().toISOString();

  return defaultProjectTypes.map((item) => ({
    ...item,
    createdAt: now,
    updatedAt: now
  }));
}

function normalizeText(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized || fallback;
}

function slugBase(label: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `type-${randomUUID().slice(0, 8)}`
  );
}

async function uniqueSlug(db: Database, label: string, currentId: string) {
  const base = slugBase(label);

  for (let index = 0; index < 30; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const row = await getFirstRow<{ id: string }>(
      db,
      "SELECT id FROM project_types WHERE slug = ? AND id <> ?",
      [slug, currentId]
    );

    if (!row) {
      return slug;
    }
  }

  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function ensureProjectTypesSeeded() {
  seedPromise ??= writeDatabase(async (db) => {
    const row = await getFirstRow<{ total: number }>(
      db,
      "SELECT COUNT(*) AS total FROM project_types"
    );

    if (Number(row?.total ?? 0) > 0) {
      return;
    }

    const now = new Date().toISOString();

    for (const type of defaultProjectTypes) {
      await db.execute(
        `INSERT INTO project_types (
          id, slug, label, category, description, active, sort_order, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          type.id,
          type.slug,
          type.label,
          type.category,
          type.description,
          type.active,
          type.sortOrder,
          now,
          now
        ]
      );
    }
  });

  return seedPromise;
}

export async function listProjectTypes(options: { activeOnly?: boolean } = {}) {
  try {
    await ensureProjectTypesSeeded();

    return readDatabase(async (db) => {
      const whereClause = options.activeOnly ? "WHERE active = 1" : "";
      const rows = await getRows<ProjectTypeRow>(
        db,
        `SELECT id, slug, label, category, description, active, sort_order, created_at, updated_at
         FROM project_types
         ${whereClause}
         ORDER BY sort_order ASC, updated_at DESC`
      );

      return rows.map(mapProjectType);
    });
  } catch (error) {
    if (!allowDatabaseFallback()) {
      throw error;
    }

    return defaultProjectTypeRows().filter((item) => !options.activeOnly || item.active);
  }
}

export async function listProjectTypeCategories() {
  const types = await listProjectTypes({ activeOnly: true });
  return Array.from(new Set(types.map((type) => type.category.trim()).filter(Boolean)));
}

export async function upsertProjectType(input: UpsertProjectTypeInput) {
  const now = new Date().toISOString();

  return writeDatabase(async (db) => {
    const id = input.id?.startsWith("draft-") || !input.id ? randomUUID() : input.id;
    const current = input.id
      ? await getFirstRow<ProjectTypeRow>(
          db,
          `SELECT id, slug, label, category, description, active, sort_order, created_at, updated_at
           FROM project_types
           WHERE id = ?`,
          [input.id]
        )
      : null;
    const label = normalizeText(input.label, current?.label ?? "新类型");
    const category = normalizeText(input.category, current?.category ?? label);
    const description = input.description ?? current?.description ?? "";
    const sortOrder = Number.isFinite(Number(input.sortOrder))
      ? Number(input.sortOrder)
      : Number(current?.sort_order ?? 999);
    const active = input.active ?? (current ? Boolean(current.active) : true);
    const slug = current?.slug ?? (await uniqueSlug(db, label, id));
    const createdAt = current?.created_at ?? now;

    await db.execute(
      `INSERT INTO project_types (
        id, slug, label, category, description, active, sort_order, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         category = VALUES(category),
         description = VALUES(description),
         active = VALUES(active),
         sort_order = VALUES(sort_order),
         updated_at = VALUES(updated_at)`,
      [id, slug, label, category, description, active, sortOrder, createdAt, now]
    );

    const row = await getFirstRow<ProjectTypeRow>(
      db,
      `SELECT id, slug, label, category, description, active, sort_order, created_at, updated_at
       FROM project_types
       WHERE id = ?`,
      [id]
    );

    if (!row) {
      throw new Error("类型保存失败。");
    }

    return mapProjectType(row);
  });
}

export async function deleteProjectType(id: string) {
  return writeDatabase(async (db) => {
    const result = await db.execute("DELETE FROM project_types WHERE id = ?", [id]);
    return result.affectedRows > 0;
  });
}

export { defaultProjectTypes };
export type { ProjectType, ProjectTypeSeed };
