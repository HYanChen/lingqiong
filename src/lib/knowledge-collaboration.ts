import { createHash, randomUUID } from "node:crypto";

import {
  getFirstRow,
  getRows,
  readDatabase,
  type Database,
  writeDatabase
} from "@/lib/database";
import { ensureKnowledgeCollaborationSchema } from "@/lib/knowledge-collaboration-schema";
import type {
  KnowledgeActor,
  KnowledgePage,
  KnowledgeSpace
} from "@/lib/knowledge-workspace";
import {
  enumValue,
  jsonValue,
  KnowledgeValidationError,
  optionalString,
  requiredRevision,
  requiredString
} from "@/lib/knowledge-validation";

export const knowledgeMemberRoles = ["owner", "editor", "commenter", "viewer"] as const;
export type KnowledgeMemberRole = (typeof knowledgeMemberRoles)[number];
export type KnowledgeAccessRole = KnowledgeMemberRole | "admin";

export type KnowledgeSpaceMember = {
  account?: string;
  addedByAccount?: string;
  addedById?: string;
  createdAt: string;
  id: string;
  revision: number;
  role: KnowledgeMemberRole;
  spaceId: string;
  updatedAt: string;
  userId: string;
};

export type KnowledgeComment = {
  authorAccount?: string;
  authorId: string;
  body: string;
  createdAt: string;
  id: string;
  parentCommentId?: string;
  revision: number;
  status: "active" | "resolved" | "deleted";
  updatedAt: string;
};

export type KnowledgePageComment = KnowledgeComment & {
  pageId: string;
  spaceId: string;
};

export type KnowledgeRecordComment = KnowledgeComment & {
  recordId: string;
  tableId: string;
};

export type KnowledgePageVersion = {
  changeSummary: string;
  content: Record<string, unknown>;
  createdAt: string;
  createdByAccount?: string;
  createdById?: string;
  id: string;
  pageId: string;
  pageRevision: number;
  spaceId: string;
  title: string;
  versionNumber: number;
};

export type KnowledgeRecordActivity = {
  action: string;
  actorAccount?: string;
  actorId?: string;
  createdAt: string;
  details: Record<string, unknown>;
  id: string;
  recordId: string;
  tableId: string;
};

type MemberRow = {
  account: string | null;
  added_by_account: string | null;
  added_by_id: string | null;
  created_at: string;
  id: string;
  member_role: string;
  revision: number;
  space_id: string;
  updated_at: string;
  user_id: string;
};

type SpaceRow = {
  color: string;
  created_at: string;
  description: string;
  icon: string;
  id: string;
  owner_account: string | null;
  owner_id: string;
  revision: number;
  title: string;
  updated_at: string;
};

type PageCommentRow = {
  author_account: string | null;
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  page_id: string;
  parent_comment_id: string | null;
  revision: number;
  space_id: string;
  status: string;
  updated_at: string;
};

type RecordCommentRow = {
  author_account: string | null;
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  parent_comment_id: string | null;
  record_id: string;
  revision: number;
  status: string;
  table_id: string;
  updated_at: string;
};

type PageVersionRow = {
  change_summary: string;
  content_json: string;
  created_at: string;
  created_by_account: string | null;
  created_by_id: string | null;
  id: string;
  page_id: string;
  page_revision: number;
  space_id: string;
  title: string;
  version_number: number;
};

type ActivityRow = {
  action: string;
  actor_account: string | null;
  actor_id: string | null;
  created_at: string;
  details_json: string;
  id: string;
  record_id: string;
  table_id: string;
};

const MEMBER_SELECT = `id, space_id, user_id, account, member_role, revision,
  added_by_id, added_by_account, created_at, updated_at`;
const PAGE_COMMENT_SELECT = `id, space_id, page_id, parent_comment_id,
  author_id, author_account, body, status, revision, created_at, updated_at`;
const RECORD_COMMENT_SELECT = `id, table_id, record_id, parent_comment_id,
  author_id, author_account, body, status, revision, created_at, updated_at`;
const VERSION_SELECT = `id, space_id, page_id, version_number, page_revision,
  title, content_json, change_summary, created_by_id, created_by_account, created_at`;
const ACTIVITY_SELECT = `id, table_id, record_id, actor_id, actor_account,
  action, details_json, created_at`;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapMember(row: MemberRow): KnowledgeSpaceMember {
  return {
    account: row.account ?? undefined,
    addedByAccount: row.added_by_account ?? undefined,
    addedById: row.added_by_id ?? undefined,
    createdAt: row.created_at,
    id: row.id,
    revision: Number(row.revision),
    role: row.member_role as KnowledgeMemberRole,
    spaceId: row.space_id,
    updatedAt: row.updated_at,
    userId: row.user_id
  };
}

function mapSpace(row: SpaceRow): KnowledgeSpace {
  return {
    color: row.color,
    createdAt: row.created_at,
    description: row.description,
    icon: row.icon,
    id: row.id,
    ownerAccount: row.owner_account ?? undefined,
    ownerId: row.owner_id,
    revision: Number(row.revision),
    title: row.title,
    updatedAt: row.updated_at
  };
}

function commentStatus(value: string): KnowledgeComment["status"] {
  return value === "resolved" || value === "deleted" ? value : "active";
}

function mapPageComment(row: PageCommentRow): KnowledgePageComment {
  return {
    authorAccount: row.author_account ?? undefined,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    pageId: row.page_id,
    parentCommentId: row.parent_comment_id ?? undefined,
    revision: Number(row.revision),
    spaceId: row.space_id,
    status: commentStatus(row.status),
    updatedAt: row.updated_at
  };
}

function mapRecordComment(row: RecordCommentRow): KnowledgeRecordComment {
  return {
    authorAccount: row.author_account ?? undefined,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    parentCommentId: row.parent_comment_id ?? undefined,
    recordId: row.record_id,
    revision: Number(row.revision),
    status: commentStatus(row.status),
    tableId: row.table_id,
    updatedAt: row.updated_at
  };
}

function mapPageVersion(row: PageVersionRow): KnowledgePageVersion {
  return {
    changeSummary: row.change_summary,
    content: parseJson<Record<string, unknown>>(row.content_json, {}),
    createdAt: row.created_at,
    createdByAccount: row.created_by_account ?? undefined,
    createdById: row.created_by_id ?? undefined,
    id: row.id,
    pageId: row.page_id,
    pageRevision: Number(row.page_revision),
    spaceId: row.space_id,
    title: row.title,
    versionNumber: Number(row.version_number)
  };
}

function mapActivity(row: ActivityRow): KnowledgeRecordActivity {
  return {
    action: row.action,
    actorAccount: row.actor_account ?? undefined,
    actorId: row.actor_id ?? undefined,
    createdAt: row.created_at,
    details: parseJson<Record<string, unknown>>(row.details_json, {}),
    id: row.id,
    recordId: row.record_id,
    tableId: row.table_id
  };
}

function notFound(resource: string): never {
  throw new KnowledgeValidationError(
    "RESOURCE_NOT_FOUND",
    `${resource}不存在或已被删除。`,
    404
  );
}

function conflict(resource: string): never {
  throw new KnowledgeValidationError(
    "REVISION_CONFLICT",
    `${resource}已被其他人更新，请刷新后重试。`,
    409
  );
}

function forbidden(message: string): never {
  throw new KnowledgeValidationError("RESOURCE_FORBIDDEN", message, 403);
}

function ownerMemberId(spaceId: string, ownerId: string) {
  return `knowledge-owner-${createHash("sha256")
    .update(`${spaceId}:${ownerId}`)
    .digest("hex")
    .slice(0, 32)}`;
}

async function lockSpace(db: Database, spaceId: string) {
  const space = await getFirstRow<{
    id: string;
    owner_account: string | null;
    owner_id: string;
  }>(
    db,
    `SELECT id, owner_id, owner_account FROM knowledge_spaces
     WHERE id = ? FOR UPDATE`,
    [spaceId]
  );

  if (!space) notFound("知识空间");
  return space;
}

async function lockTable(db: Database, tableId: string) {
  const table = await getFirstRow<{ id: string; space_id: string }>(
    db,
    `SELECT id, space_id FROM knowledge_tables
     WHERE id = ? AND deleted_at IS NULL`,
    [tableId]
  );
  if (!table) notFound("多维表格");
  await lockSpace(db, table.space_id);
  const locked = await getFirstRow<{ id: string; space_id: string }>(
    db,
    `SELECT id, space_id FROM knowledge_tables
     WHERE id = ? AND space_id = ? AND deleted_at IS NULL FOR UPDATE`,
    [tableId, table.space_id]
  );
  if (!locked) notFound("多维表格");
  return locked;
}

async function ensureOwnerMemberWithDatabase(
  db: Database,
  space: { id: string; owner_account: string | null; owner_id: string }
) {
  const now = new Date().toISOString();
  await db.execute(
    `INSERT IGNORE INTO knowledge_space_members
     (id, space_id, user_id, account, member_role, revision, added_by_id,
      added_by_account, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'owner', 1, ?, ?, ?, ?)`,
    [
      ownerMemberId(space.id, space.owner_id),
      space.id,
      space.owner_id,
      space.owner_account,
      space.owner_id,
      space.owner_account,
      now,
      now
    ]
  );
}

export async function ensureKnowledgeSpaceOwnerMember(spaceId: string) {
  await ensureKnowledgeCollaborationSchema();
  return writeDatabase(async (db) => {
    const space = await lockSpace(db, spaceId);
    await ensureOwnerMemberWithDatabase(db, space);
  });
}

export async function getKnowledgeSpaceMemberRole(
  spaceId: string,
  userId: string
) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) => {
    const space = await getFirstRow<{ owner_id: string }>(
      db,
      "SELECT owner_id FROM knowledge_spaces WHERE id = ?",
      [spaceId]
    );
    if (!space) return null;
    if (space.owner_id === userId) return "owner" as const;
    const member = await getFirstRow<{ member_role: string }>(
      db,
      `SELECT member_role FROM knowledge_space_members
       WHERE space_id = ? AND user_id = ?`,
      [spaceId, userId]
    );
    return member && knowledgeMemberRoles.includes(member.member_role as KnowledgeMemberRole)
      ? (member.member_role as KnowledgeMemberRole)
      : null;
  });
}

export function knowledgeRoleCan(
  role: KnowledgeAccessRole,
  capability: "comment" | "manage" | "read" | "write"
) {
  if (role === "admin" || role === "owner") return true;
  if (capability === "read") return true;
  if (capability === "comment") return role === "commenter" || role === "editor";
  if (capability === "write") return role === "editor";
  return false;
}

export async function listAccessibleKnowledgeSpaces(userId: string) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) =>
    (
      await getRows<SpaceRow>(
        db,
        `SELECT DISTINCT s.id, s.owner_id, s.owner_account, s.title,
          s.description, s.icon, s.color, s.revision, s.created_at, s.updated_at
         FROM knowledge_spaces s
         LEFT JOIN knowledge_space_members m
           ON m.space_id = s.id AND m.user_id = ?
         WHERE s.owner_id = ? OR m.user_id = ?
         ORDER BY s.updated_at DESC`,
        [userId, userId, userId]
      )
    ).map(mapSpace)
  );
}

export async function listKnowledgeSpaceMembers(spaceId: string) {
  await ensureKnowledgeCollaborationSchema();
  await ensureKnowledgeSpaceOwnerMember(spaceId);
  return readDatabase(async (db) =>
    (
      await getRows<MemberRow>(
        db,
        `SELECT ${MEMBER_SELECT} FROM knowledge_space_members
         WHERE space_id = ?
         ORDER BY FIELD(member_role, 'owner', 'editor', 'commenter', 'viewer'), created_at`,
        [spaceId]
      )
    ).map(mapMember)
  );
}

export async function createKnowledgeSpaceMember(
  spaceId: string,
  actor: KnowledgeActor,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const userId = requiredString(input.userId, "用户 ID", 191);
  const role = enumValue(
    input.role,
    "成员角色",
    ["editor", "commenter", "viewer"] as const,
    "viewer"
  );
  const account = optionalString(input.account, "成员账号", 255);
  return writeDatabase(async (db) => {
    const space = await lockSpace(db, spaceId);
    await ensureOwnerMemberWithDatabase(db, space);
    if (userId === space.owner_id) {
      throw new KnowledgeValidationError("RESOURCE_CONFLICT", "空间所有者已在成员列表中。", 409);
    }
    const now = new Date().toISOString();
    const member: KnowledgeSpaceMember = {
      account,
      addedByAccount: actor.account,
      addedById: actor.id,
      createdAt: now,
      id: randomUUID(),
      revision: 1,
      role,
      spaceId,
      updatedAt: now,
      userId
    };
    await db.execute(
      `INSERT INTO knowledge_space_members
       (id, space_id, user_id, account, member_role, revision, added_by_id,
        added_by_account, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [member.id, spaceId, userId, account ?? null, role, actor.id, actor.account ?? null, now, now]
    );
    return member;
  });
}

export async function updateKnowledgeSpaceMember(
  spaceId: string,
  memberId: string,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const revision = requiredRevision(input.revision);
  const role = enumValue(input.role, "成员角色", ["editor", "commenter", "viewer"] as const);
  const account = optionalString(input.account, "成员账号", 255);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const row = await getFirstRow<MemberRow>(
      db,
      `SELECT ${MEMBER_SELECT} FROM knowledge_space_members
       WHERE id = ? AND space_id = ? FOR UPDATE`,
      [memberId, spaceId]
    );
    if (!row) notFound("空间成员");
    const member = mapMember(row);
    if (member.role === "owner") forbidden("不能修改空间所有者的角色。");
    if (member.revision !== revision) conflict("空间成员");
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_space_members SET account = ?, member_role = ?,
       revision = revision + 1, updated_at = ?
       WHERE id = ? AND space_id = ? AND revision = ?`,
      [account === undefined ? member.account ?? null : account, role, now, memberId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("空间成员");
    return {
      ...member,
      account: account === undefined ? member.account : account || undefined,
      revision: revision + 1,
      role,
      updatedAt: now
    };
  });
}

export async function deleteKnowledgeSpaceMember(
  spaceId: string,
  memberId: string,
  revision: number
) {
  await ensureKnowledgeCollaborationSchema();
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const row = await getFirstRow<MemberRow>(
      db,
      `SELECT ${MEMBER_SELECT} FROM knowledge_space_members
       WHERE id = ? AND space_id = ? FOR UPDATE`,
      [memberId, spaceId]
    );
    if (!row) notFound("空间成员");
    if (row.member_role === "owner") forbidden("不能移除空间所有者。");
    if (Number(row.revision) !== revision) conflict("空间成员");
    const result = await db.execute(
      `DELETE FROM knowledge_space_members
       WHERE id = ? AND space_id = ? AND revision = ?`,
      [memberId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("空间成员");
    return true;
  });
}

function commentBody(value: unknown) {
  return requiredString(value, "评论内容", 10_000);
}

function parentCommentId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, "父评论 ID", 191);
}

async function assertPage(db: Database, spaceId: string, pageId: string) {
  const page = await getFirstRow<{ id: string }>(
    db,
    `SELECT id FROM knowledge_pages
     WHERE id = ? AND space_id = ? AND deleted_at IS NULL`,
    [pageId, spaceId]
  );
  if (!page) notFound("页面");
}

async function assertRecord(db: Database, tableId: string, recordId: string) {
  const record = await getFirstRow<{ id: string }>(
    db,
    "SELECT id FROM knowledge_records WHERE id = ? AND table_id = ?",
    [recordId, tableId]
  );
  if (!record) notFound("记录");
}

export async function listKnowledgePageComments(spaceId: string, pageId: string) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) => {
    await assertPage(db, spaceId, pageId);
    return (
      await getRows<PageCommentRow>(
        db,
        `SELECT ${PAGE_COMMENT_SELECT} FROM knowledge_page_comments
         WHERE space_id = ? AND page_id = ? ORDER BY created_at`,
        [spaceId, pageId]
      )
    ).map(mapPageComment);
  });
}

export async function createKnowledgePageComment(
  spaceId: string,
  pageId: string,
  actor: KnowledgeActor,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const body = commentBody(input.body);
  const parentId = parentCommentId(input.parentCommentId);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    await assertPage(db, spaceId, pageId);
    if (parentId) {
      const parent = await getFirstRow<{ id: string }>(
        db,
        `SELECT id FROM knowledge_page_comments
         WHERE id = ? AND page_id = ? AND space_id = ? AND status <> 'deleted'`,
        [parentId, pageId, spaceId]
      );
      if (!parent) notFound("父评论");
    }
    const now = new Date().toISOString();
    const comment: KnowledgePageComment = {
      authorAccount: actor.account,
      authorId: actor.id,
      body,
      createdAt: now,
      id: randomUUID(),
      pageId,
      parentCommentId: parentId ?? undefined,
      revision: 1,
      spaceId,
      status: "active",
      updatedAt: now
    };
    await db.execute(
      `INSERT INTO knowledge_page_comments
       (id, space_id, page_id, parent_comment_id, author_id, author_account,
        body, status, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
      [comment.id, spaceId, pageId, parentId, actor.id, actor.account ?? null, body, now, now]
    );
    return comment;
  });
}

export async function updateKnowledgePageComment(
  spaceId: string,
  pageId: string,
  commentId: string,
  actor: KnowledgeActor,
  canModerate: boolean,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const row = await getFirstRow<PageCommentRow>(
      db,
      `SELECT ${PAGE_COMMENT_SELECT} FROM knowledge_page_comments
       WHERE id = ? AND page_id = ? AND space_id = ? FOR UPDATE`,
      [commentId, pageId, spaceId]
    );
    if (!row) notFound("页面评论");
    const current = mapPageComment(row);
    if (current.status === "deleted") notFound("页面评论");
    if (current.authorId !== actor.id && !canModerate) forbidden("只能修改自己的评论。");
    if (current.revision !== revision) conflict("页面评论");
    const body = input.body === undefined ? current.body : commentBody(input.body);
    const status = input.status === undefined
      ? current.status
      : enumValue(input.status, "评论状态", ["active", "resolved"] as const);
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_page_comments SET body = ?, status = ?, revision = revision + 1,
       updated_at = ? WHERE id = ? AND page_id = ? AND space_id = ? AND revision = ?`,
      [body, status, now, commentId, pageId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("页面评论");
    return { ...current, body, revision: revision + 1, status, updatedAt: now };
  });
}

export async function deleteKnowledgePageComment(
  spaceId: string,
  pageId: string,
  commentId: string,
  actor: KnowledgeActor,
  canModerate: boolean,
  revision: number
) {
  await ensureKnowledgeCollaborationSchema();
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const row = await getFirstRow<PageCommentRow>(
      db,
      `SELECT ${PAGE_COMMENT_SELECT} FROM knowledge_page_comments
       WHERE id = ? AND page_id = ? AND space_id = ? FOR UPDATE`,
      [commentId, pageId, spaceId]
    );
    if (!row || row.status === "deleted") notFound("页面评论");
    if (row.author_id !== actor.id && !canModerate) forbidden("只能删除自己的评论。");
    if (Number(row.revision) !== revision) conflict("页面评论");
    const result = await db.execute(
      `UPDATE knowledge_page_comments SET body = '', status = 'deleted',
       revision = revision + 1, updated_at = ?
       WHERE id = ? AND page_id = ? AND space_id = ? AND revision = ?`,
      [new Date().toISOString(), commentId, pageId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("页面评论");
    return true;
  });
}

export async function listKnowledgeRecordComments(tableId: string, recordId: string) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) => {
    await assertRecord(db, tableId, recordId);
    return (
      await getRows<RecordCommentRow>(
        db,
        `SELECT ${RECORD_COMMENT_SELECT} FROM knowledge_record_comments
         WHERE table_id = ? AND record_id = ? ORDER BY created_at`,
        [tableId, recordId]
      )
    ).map(mapRecordComment);
  });
}

export async function createKnowledgeRecordComment(
  tableId: string,
  recordId: string,
  actor: KnowledgeActor,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const body = commentBody(input.body);
  const parentId = parentCommentId(input.parentCommentId);
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    await assertRecord(db, tableId, recordId);
    if (parentId) {
      const parent = await getFirstRow<{ id: string }>(
        db,
        `SELECT id FROM knowledge_record_comments
         WHERE id = ? AND record_id = ? AND table_id = ? AND status <> 'deleted'`,
        [parentId, recordId, tableId]
      );
      if (!parent) notFound("父评论");
    }
    const now = new Date().toISOString();
    const comment: KnowledgeRecordComment = {
      authorAccount: actor.account,
      authorId: actor.id,
      body,
      createdAt: now,
      id: randomUUID(),
      parentCommentId: parentId ?? undefined,
      recordId,
      revision: 1,
      status: "active",
      tableId,
      updatedAt: now
    };
    await db.execute(
      `INSERT INTO knowledge_record_comments
       (id, table_id, record_id, parent_comment_id, author_id, author_account,
        body, status, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)`,
      [comment.id, tableId, recordId, parentId, actor.id, actor.account ?? null, body, now, now]
    );
    await recordKnowledgeActivity(db, {
      action: "commented",
      actor,
      details: { commentId: comment.id },
      recordId,
      tableId
    });
    return comment;
  });
}

export async function updateKnowledgeRecordComment(
  tableId: string,
  recordId: string,
  commentId: string,
  actor: KnowledgeActor,
  canModerate: boolean,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RecordCommentRow>(
      db,
      `SELECT ${RECORD_COMMENT_SELECT} FROM knowledge_record_comments
       WHERE id = ? AND record_id = ? AND table_id = ? FOR UPDATE`,
      [commentId, recordId, tableId]
    );
    if (!row) notFound("记录评论");
    const current = mapRecordComment(row);
    if (current.status === "deleted") notFound("记录评论");
    if (current.authorId !== actor.id && !canModerate) forbidden("只能修改自己的评论。");
    if (current.revision !== revision) conflict("记录评论");
    const body = input.body === undefined ? current.body : commentBody(input.body);
    const status = input.status === undefined
      ? current.status
      : enumValue(input.status, "评论状态", ["active", "resolved"] as const);
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_record_comments SET body = ?, status = ?, revision = revision + 1,
       updated_at = ? WHERE id = ? AND record_id = ? AND table_id = ? AND revision = ?`,
      [body, status, now, commentId, recordId, tableId, revision]
    );
    if (!result.affectedRows) conflict("记录评论");
    return { ...current, body, revision: revision + 1, status, updatedAt: now };
  });
}

export async function deleteKnowledgeRecordComment(
  tableId: string,
  recordId: string,
  commentId: string,
  actor: KnowledgeActor,
  canModerate: boolean,
  revision: number
) {
  await ensureKnowledgeCollaborationSchema();
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RecordCommentRow>(
      db,
      `SELECT ${RECORD_COMMENT_SELECT} FROM knowledge_record_comments
       WHERE id = ? AND record_id = ? AND table_id = ? FOR UPDATE`,
      [commentId, recordId, tableId]
    );
    if (!row || row.status === "deleted") notFound("记录评论");
    if (row.author_id !== actor.id && !canModerate) forbidden("只能删除自己的评论。");
    if (Number(row.revision) !== revision) conflict("记录评论");
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_record_comments SET body = '', status = 'deleted',
       revision = revision + 1, updated_at = ?
       WHERE id = ? AND record_id = ? AND table_id = ? AND revision = ?`,
      [now, commentId, recordId, tableId, revision]
    );
    if (!result.affectedRows) conflict("记录评论");
    await recordKnowledgeActivity(db, {
      action: "comment_deleted",
      actor,
      details: { commentId },
      recordId,
      tableId
    });
    return true;
  });
}

export async function recordKnowledgePageVersion(
  db: Database,
  input: {
    actor?: KnowledgeActor;
    changeSummary?: string;
    content: Record<string, unknown>;
    pageId: string;
    pageRevision: number;
    spaceId: string;
    title: string;
  }
) {
  const latest = await getFirstRow<{ version_number: number }>(
    db,
    `SELECT version_number FROM knowledge_page_versions
     WHERE page_id = ? ORDER BY version_number DESC LIMIT 1 FOR UPDATE`,
    [input.pageId]
  );
  const versionNumber = Number(latest?.version_number ?? 0) + 1;
  const now = new Date().toISOString();
  const version: KnowledgePageVersion = {
    changeSummary: input.changeSummary?.trim().slice(0, 1000) ?? "",
    content: input.content,
    createdAt: now,
    createdByAccount: input.actor?.account,
    createdById: input.actor?.id,
    id: randomUUID(),
    pageId: input.pageId,
    pageRevision: input.pageRevision,
    spaceId: input.spaceId,
    title: input.title,
    versionNumber
  };
  await db.execute(
    `INSERT INTO knowledge_page_versions
     (id, space_id, page_id, version_number, page_revision, title, content_json,
      change_summary, created_by_id, created_by_account, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      version.id,
      input.spaceId,
      input.pageId,
      versionNumber,
      input.pageRevision,
      input.title,
      JSON.stringify(input.content),
      version.changeSummary,
      input.actor?.id ?? null,
      input.actor?.account ?? null,
      now
    ]
  );
  return version;
}

export async function ensureKnowledgePageVersionHistory(
  page: KnowledgePage,
  actor?: KnowledgeActor
) {
  await ensureKnowledgeCollaborationSchema();
  return writeDatabase(async (db) => {
    await lockSpace(db, page.spaceId);
    const existing = await getFirstRow<{ id: string }>(
      db,
      "SELECT id FROM knowledge_page_versions WHERE page_id = ? LIMIT 1 FOR UPDATE",
      [page.id]
    );
    if (existing) return;
    await recordKnowledgePageVersion(db, {
      actor,
      changeSummary: "初始版本",
      content: page.content,
      pageId: page.id,
      pageRevision: page.revision,
      spaceId: page.spaceId,
      title: page.title
    });
  });
}

export async function listKnowledgePageVersions(spaceId: string, pageId: string) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) => {
    await assertPage(db, spaceId, pageId);
    return (
      await getRows<PageVersionRow>(
        db,
        `SELECT ${VERSION_SELECT} FROM knowledge_page_versions
         WHERE space_id = ? AND page_id = ? ORDER BY version_number DESC`,
        [spaceId, pageId]
      )
    ).map(mapPageVersion);
  });
}

export async function getKnowledgePageVersion(
  spaceId: string,
  pageId: string,
  versionId: string
) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) => {
    await assertPage(db, spaceId, pageId);
    const row = await getFirstRow<PageVersionRow>(
      db,
      `SELECT ${VERSION_SELECT} FROM knowledge_page_versions
       WHERE id = ? AND page_id = ? AND space_id = ?`,
      [versionId, pageId, spaceId]
    );
    return row ? mapPageVersion(row) : null;
  });
}

export async function recordKnowledgeActivity(
  db: Database,
  input: {
    action: string;
    actor?: KnowledgeActor;
    details?: Record<string, unknown>;
    recordId: string;
    tableId: string;
  }
) {
  const action = requiredString(input.action, "活动类型", 64);
  const details = jsonValue(input.details ?? {}, "活动详情", {
    maxBytes: 64 * 1024,
    objectOnly: true
  }) as Record<string, unknown>;
  const activity: KnowledgeRecordActivity = {
    action,
    actorAccount: input.actor?.account,
    actorId: input.actor?.id,
    createdAt: new Date().toISOString(),
    details,
    id: randomUUID(),
    recordId: input.recordId,
    tableId: input.tableId
  };
  await db.execute(
    `INSERT INTO knowledge_record_activities
     (id, table_id, record_id, actor_id, actor_account, action, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      activity.id,
      input.tableId,
      input.recordId,
      input.actor?.id ?? null,
      input.actor?.account ?? null,
      action,
      JSON.stringify(details),
      activity.createdAt
    ]
  );
  return activity;
}

export async function listKnowledgeRecordActivities(
  tableId: string,
  recordId: string,
  limit = 200
) {
  await ensureKnowledgeCollaborationSchema();
  const bounded = Math.max(1, Math.min(500, Math.floor(limit)));
  return readDatabase(async (db) =>
    (
      await getRows<ActivityRow>(
        db,
        `SELECT ${ACTIVITY_SELECT} FROM knowledge_record_activities
         WHERE table_id = ? AND record_id = ? ORDER BY created_at DESC LIMIT ${bounded}`,
        [tableId, recordId]
      )
    ).map(mapActivity)
  );
}

export async function listKnowledgeSpacesIncludingMembers(userId: string) {
  return listAccessibleKnowledgeSpaces(userId);
}
