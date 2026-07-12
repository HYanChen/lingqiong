import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase
} from "@/lib/database";
import { ensureKnowledgeAttachmentSchema } from "@/lib/knowledge-attachment-schema";
import { KnowledgeValidationError } from "@/lib/knowledge-validation";
import type { KnowledgeActor } from "@/lib/knowledge-workspace";

export const MAX_KNOWLEDGE_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const MAX_KNOWLEDGE_ATTACHMENT_REQUEST_SIZE =
  MAX_KNOWLEDGE_ATTACHMENT_SIZE + 1024 * 1024;

const DEFAULT_MIME_TYPE = "application/octet-stream";
const ATTACHMENT_SELECT = `id, space_id, table_id, record_id, file_name,
  storage_name, mime_type, file_size, uploaded_by_id, uploaded_by_account,
  revision, created_at, updated_at`;
const STORAGE_NAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.[a-z0-9]{1,16})?$/i;
const MIME_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

export type KnowledgeAttachment = {
  createdAt: string;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  recordId: string;
  revision: number;
  spaceId: string;
  tableId: string;
  updatedAt: string;
  uploadedByAccount?: string;
  uploadedById?: string;
};

type StoredKnowledgeAttachment = KnowledgeAttachment & {
  storageName: string;
};

type AttachmentRow = {
  created_at: string;
  file_name: string;
  file_size: number | string;
  id: string;
  mime_type: string;
  record_id: string;
  revision: number;
  space_id: string;
  storage_name: string;
  table_id: string;
  updated_at: string;
  uploaded_by_account: string | null;
  uploaded_by_id: string | null;
};

type CreateKnowledgeAttachmentInput = {
  actor: KnowledgeActor;
  content: Uint8Array;
  fileName: string;
  mimeType?: string;
  recordId: string;
  spaceId: string;
  tableId: string;
};

function assertId(value: string, label: string) {
  if (!value || value.length > 191) {
    throw new KnowledgeValidationError(
      "INVALID_RESOURCE_ID",
      `${label} ID 格式不正确。`
    );
  }
}

function attachmentRoot() {
  const dataRoot = process.env.WCU_DATA_DIR?.trim() || "/app/data";
  return path.resolve(dataRoot, "knowledge-uploads");
}

function attachmentPath(storageName: string) {
  if (!STORAGE_NAME_PATTERN.test(storageName)) {
    throw new KnowledgeValidationError(
      "ATTACHMENT_STORAGE_INVALID",
      "附件存储路径无效。",
      500
    );
  }

  const root = attachmentRoot();
  const resolved = path.resolve(root, storageName);

  if (path.dirname(resolved) !== root) {
    throw new KnowledgeValidationError(
      "ATTACHMENT_STORAGE_INVALID",
      "附件存储路径无效。",
      500
    );
  }

  return resolved;
}

function safeExtension(value: string) {
  const extension = path.posix.extname(value).toLowerCase();
  return /^\.[a-z0-9]{1,16}$/.test(extension) ? extension : "";
}

export function safeKnowledgeAttachmentName(value: string) {
  const leaf = path.posix.basename(value.replaceAll("\\", "/"));
  const normalized = leaf.normalize("NFKC").replace(/\p{Cc}+/gu, "").trim();
  const extension = safeExtension(normalized);
  const baseSource = extension
    ? normalized.slice(0, normalized.length - extension.length)
    : normalized;
  const base = baseSource
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^[. _-]+|[. _-]+$/g, "")
    .slice(0, 255 - extension.length)
    .trim();

  return `${base || "attachment"}${extension}`;
}

function safeMimeType(value?: string) {
  const mimeType = value?.trim().toLowerCase();

  return mimeType && mimeType.length <= 255 && MIME_TYPE_PATTERN.test(mimeType)
    ? mimeType
    : DEFAULT_MIME_TYPE;
}

function mapAttachment(row: AttachmentRow): StoredKnowledgeAttachment {
  return {
    createdAt: row.created_at,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    id: row.id,
    mimeType: row.mime_type,
    recordId: row.record_id,
    revision: Number(row.revision),
    spaceId: row.space_id,
    storageName: row.storage_name,
    tableId: row.table_id,
    updatedAt: row.updated_at,
    uploadedByAccount: row.uploaded_by_account ?? undefined,
    uploadedById: row.uploaded_by_id ?? undefined
  };
}

function publicAttachment(
  attachment: StoredKnowledgeAttachment
): KnowledgeAttachment {
  return {
    createdAt: attachment.createdAt,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    id: attachment.id,
    mimeType: attachment.mimeType,
    recordId: attachment.recordId,
    revision: attachment.revision,
    spaceId: attachment.spaceId,
    tableId: attachment.tableId,
    updatedAt: attachment.updatedAt,
    uploadedByAccount: attachment.uploadedByAccount,
    uploadedById: attachment.uploadedById
  };
}

function storageNameFor(fileName: string) {
  return `${randomUUID()}${safeExtension(fileName)}`;
}

function isMissingFile(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export function knowledgeAttachmentContentDisposition(fileName: string) {
  const fallback = Array.from(fileName)
    .map((character) =>
      /^[A-Za-z0-9._ -]$/.test(character) ? character : "_"
    )
    .join("")
    .replace(/_+/g, "_")
    .slice(0, 255);
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `attachment; filename="${fallback || "attachment"}"; filename*=UTF-8''${encoded}`;
}

export async function listKnowledgeAttachments(
  spaceId: string,
  tableId: string,
  recordId: string
) {
  assertId(spaceId, "知识空间");
  assertId(tableId, "多维表格");
  assertId(recordId, "记录");
  await ensureKnowledgeAttachmentSchema();

  return readDatabase(async (db) =>
    (
      await getRows<AttachmentRow>(
        db,
        `SELECT ${ATTACHMENT_SELECT}
         FROM knowledge_record_attachments
         WHERE space_id = ? AND table_id = ? AND record_id = ?
         ORDER BY created_at DESC, id DESC`,
        [spaceId, tableId, recordId]
      )
    ).map(mapAttachment).map(publicAttachment)
  );
}

export async function createKnowledgeAttachment(
  input: CreateKnowledgeAttachmentInput
) {
  assertId(input.spaceId, "知识空间");
  assertId(input.tableId, "多维表格");
  assertId(input.recordId, "记录");
  await ensureKnowledgeAttachmentSchema();

  const content = Buffer.from(input.content);

  if (!content.byteLength) {
    throw new KnowledgeValidationError("EMPTY_ATTACHMENT", "不能上传空文件。");
  }

  if (content.byteLength > MAX_KNOWLEDGE_ATTACHMENT_SIZE) {
    throw new KnowledgeValidationError(
      "ATTACHMENT_TOO_LARGE",
      "单个附件不能超过 20MB。",
      413
    );
  }

  const now = new Date().toISOString();
  const fileName = safeKnowledgeAttachmentName(input.fileName);
  const stored: StoredKnowledgeAttachment = {
    createdAt: now,
    fileName,
    fileSize: content.byteLength,
    id: randomUUID(),
    mimeType: safeMimeType(input.mimeType),
    recordId: input.recordId,
    revision: 1,
    spaceId: input.spaceId,
    storageName: storageNameFor(fileName),
    tableId: input.tableId,
    updatedAt: now,
    uploadedByAccount: input.actor.account,
    uploadedById: input.actor.id
  };
  const root = attachmentRoot();
  const absolutePath = attachmentPath(stored.storageName);

  await mkdir(root, { mode: 0o750, recursive: true });
  await writeFile(absolutePath, content, { flag: "wx", mode: 0o640 });

  try {
    await writeDatabase(async (db) => {
      const record = await getFirstRow<{ id: string }>(
        db,
        `SELECT records.id
         FROM knowledge_records records
         INNER JOIN knowledge_tables tables ON tables.id = records.table_id
         WHERE records.id = ? AND records.table_id = ?
           AND tables.id = ? AND tables.space_id = ?
           AND tables.deleted_at IS NULL
         FOR UPDATE`,
        [input.recordId, input.tableId, input.tableId, input.spaceId]
      );

      if (!record) {
        throw new KnowledgeValidationError(
          "RECORD_NOT_FOUND",
          "记录不存在或不属于当前表格。",
          404
        );
      }

      await db.execute(
        `INSERT INTO knowledge_record_attachments (
          id, space_id, table_id, record_id, file_name, storage_name,
          mime_type, file_size, uploaded_by_id, uploaded_by_account,
          revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          stored.id,
          stored.spaceId,
          stored.tableId,
          stored.recordId,
          stored.fileName,
          stored.storageName,
          stored.mimeType,
          stored.fileSize,
          stored.uploadedById ?? null,
          stored.uploadedByAccount ?? null,
          stored.createdAt,
          stored.updatedAt
        ]
      );
    });
  } catch (error) {
    await rm(absolutePath, { force: true }).catch(() => undefined);
    throw error;
  }

  return publicAttachment(stored);
}

export async function getKnowledgeAttachmentDownload(
  spaceId: string,
  tableId: string,
  recordId: string,
  attachmentId: string
) {
  assertId(spaceId, "知识空间");
  assertId(tableId, "多维表格");
  assertId(recordId, "记录");
  assertId(attachmentId, "附件");
  await ensureKnowledgeAttachmentSchema();

  const stored = await readDatabase(async (db) => {
    const row = await getFirstRow<AttachmentRow>(
      db,
      `SELECT ${ATTACHMENT_SELECT}
       FROM knowledge_record_attachments
       WHERE id = ? AND space_id = ? AND table_id = ? AND record_id = ?`,
      [attachmentId, spaceId, tableId, recordId]
    );

    return row ? mapAttachment(row) : null;
  });

  if (!stored) {
    return null;
  }

  try {
    return {
      attachment: publicAttachment(stored),
      content: await readFile(attachmentPath(stored.storageName))
    };
  } catch (error) {
    if (isMissingFile(error)) {
      throw new KnowledgeValidationError(
        "ATTACHMENT_CONTENT_NOT_FOUND",
        "附件内容不存在。",
        404
      );
    }

    throw error;
  }
}

export async function deleteKnowledgeAttachment(
  spaceId: string,
  tableId: string,
  recordId: string,
  attachmentId: string,
  revision: number
) {
  assertId(spaceId, "知识空间");
  assertId(tableId, "多维表格");
  assertId(recordId, "记录");
  assertId(attachmentId, "附件");
  await ensureKnowledgeAttachmentSchema();

  const deleted = await writeDatabase(async (db) => {
    const row = await getFirstRow<AttachmentRow>(
      db,
      `SELECT ${ATTACHMENT_SELECT}
       FROM knowledge_record_attachments
       WHERE id = ? AND space_id = ? AND table_id = ? AND record_id = ?
       FOR UPDATE`,
      [attachmentId, spaceId, tableId, recordId]
    );

    if (!row) {
      return null;
    }

    const current = mapAttachment(row);
    const absolutePath = attachmentPath(current.storageName);

    if (current.revision !== revision) {
      throw new KnowledgeValidationError(
        "REVISION_CONFLICT",
        "附件已被其他操作更新，请刷新后重试。",
        409,
        { currentRevision: current.revision }
      );
    }

    const result = await db.execute(
      `DELETE FROM knowledge_record_attachments
       WHERE id = ? AND space_id = ? AND table_id = ? AND record_id = ?
         AND revision = ?`,
      [attachmentId, spaceId, tableId, recordId, revision]
    );

    if (!result.affectedRows) {
      throw new KnowledgeValidationError(
        "REVISION_CONFLICT",
        "附件已被其他操作更新，请刷新后重试。",
        409
      );
    }

    return { absolutePath, attachment: publicAttachment(current) };
  });

  if (!deleted) {
    return null;
  }

  try {
    await rm(deleted.absolutePath, { force: true });
  } catch (error) {
    console.error("Failed to remove deleted knowledge attachment", error);
  }

  return deleted.attachment;
}

async function purgeKnowledgeAttachments(
  whereClause: string,
  parameters: string[]
) {
  await ensureKnowledgeAttachmentSchema();

  const storageNames = await writeDatabase(async (db) => {
    const rows = await getRows<{ storage_name: string }>(
      db,
      `SELECT storage_name FROM knowledge_record_attachments WHERE ${whereClause} FOR UPDATE`,
      parameters
    );
    await db.execute(
      `DELETE FROM knowledge_record_attachments WHERE ${whereClause}`,
      parameters
    );
    return rows.map((row) => row.storage_name);
  });

  await Promise.all(
    storageNames.map(async (storageName) => {
      try {
        await rm(attachmentPath(storageName), { force: true });
      } catch (error) {
        console.error("Failed to remove purged knowledge attachment", error);
      }
    })
  );

  return storageNames.length;
}

export function purgeKnowledgeRecordAttachments(
  tableId: string,
  recordId: string
) {
  assertId(tableId, "多维表格");
  assertId(recordId, "记录");
  return purgeKnowledgeAttachments("table_id = ? AND record_id = ?", [
    tableId,
    recordId
  ]);
}

export function purgeKnowledgeTableAttachments(tableId: string) {
  assertId(tableId, "多维表格");
  return purgeKnowledgeAttachments("table_id = ?", [tableId]);
}

export function purgeKnowledgeSpaceAttachments(spaceId: string) {
  assertId(spaceId, "知识空间");
  return purgeKnowledgeAttachments("space_id = ?", [spaceId]);
}
