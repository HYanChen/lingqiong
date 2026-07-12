import { createHash, randomUUID } from "node:crypto";

import {
  getFirstRow,
  getRows,
  readDatabase,
  type Database,
  writeDatabase
} from "@/lib/database";
import {
  purgeKnowledgeRecordAttachments,
  purgeKnowledgeSpaceAttachments
} from "@/lib/knowledge-attachments";
import {
  executeKnowledgeAutomationRuns,
  queueKnowledgeAutomationRuns
} from "@/lib/knowledge-automations";
import {
  recordKnowledgeActivity,
  recordKnowledgePageVersion
} from "@/lib/knowledge-collaboration";
import { ensureKnowledgeCollaborationSchema } from "@/lib/knowledge-collaboration-schema";
import { ensureKnowledgeSchema } from "@/lib/knowledge-schema";
import {
  moveKnowledgePageToTrash,
  moveKnowledgeTableToTrash
} from "@/lib/knowledge-trash";
import {
  enumValue,
  isPlainObject,
  jsonValue,
  knowledgeFieldTypes,
  knowledgePageTypes,
  knowledgeViewTypes,
  KnowledgeValidationError,
  optionalBoolean,
  optionalInteger,
  optionalNullableId,
  optionalString,
  requiredRevision,
  requiredString,
  slugifyKnowledgePage,
  type KnowledgeFieldType,
  type KnowledgePageType,
  type KnowledgeViewType
} from "@/lib/knowledge-validation";

export type KnowledgeActor = {
  account?: string;
  id: string;
};

export type KnowledgeSpace = {
  color: string;
  createdAt: string;
  description: string;
  icon: string;
  id: string;
  ownerAccount?: string;
  ownerId: string;
  revision: number;
  title: string;
  updatedAt: string;
};

export type KnowledgePage = {
  content: Record<string, unknown>;
  createdAt: string;
  icon: string;
  id: string;
  pageType: KnowledgePageType;
  parentId?: string;
  revision: number;
  slug: string;
  sortOrder: number;
  spaceId: string;
  title: string;
  updatedAt: string;
};

export type KnowledgeTable = {
  createdAt: string;
  description: string;
  icon: string;
  id: string;
  revision: number;
  spaceId: string;
  title: string;
  updatedAt: string;
};

export type KnowledgeField = {
  config: Record<string, unknown>;
  createdAt: string;
  fieldType: KnowledgeFieldType;
  id: string;
  name: string;
  revision: number;
  sortOrder: number;
  tableId: string;
  updatedAt: string;
};

export type KnowledgeRecord = {
  createdAt: string;
  createdByAccount?: string;
  createdById?: string;
  id: string;
  revision: number;
  sortOrder: number;
  tableId: string;
  updatedAt: string;
  updatedByAccount?: string;
  updatedById?: string;
  values: Record<string, unknown>;
};

export type KnowledgeView = {
  createdAt: string;
  filter: Record<string, unknown>;
  frozenFieldCount: number;
  group: Record<string, unknown>;
  id: string;
  isDefault: boolean;
  name: string;
  revision: number;
  rowHeight: "compact" | "medium" | "tall";
  sort: unknown[];
  tableId: string;
  updatedAt: string;
  viewType: KnowledgeViewType;
  visibleFieldIds: string[];
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

type PageRow = {
  content_json: string;
  created_at: string;
  icon: string;
  id: string;
  page_type: string;
  parent_id: string | null;
  revision: number;
  slug: string;
  sort_order: number;
  space_id: string;
  title: string;
  updated_at: string;
};

type TableRow = {
  created_at: string;
  description: string;
  icon: string;
  id: string;
  revision: number;
  space_id: string;
  title: string;
  updated_at: string;
};

type FieldRow = {
  config_json: string;
  created_at: string;
  field_type: string;
  id: string;
  name: string;
  revision: number;
  sort_order: number;
  table_id: string;
  updated_at: string;
};

type RecordRow = {
  created_at: string;
  created_by_account: string | null;
  created_by_id: string | null;
  id: string;
  revision: number;
  sort_order: number;
  table_id: string;
  updated_at: string;
  updated_by_account: string | null;
  updated_by_id: string | null;
  values_json: string;
};

type ViewRow = {
  created_at: string;
  filter_json: string;
  frozen_field_count: number;
  group_json: string;
  id: string;
  is_default: number;
  name: string;
  revision: number;
  row_height: string;
  sort_json: string;
  table_id: string;
  updated_at: string;
  view_type: string;
  visible_field_ids_json: string;
};

const SPACE_SELECT = `id, owner_id, owner_account, title, description, icon, color,
  revision, created_at, updated_at`;
const PAGE_SELECT = `id, space_id, parent_id, title, slug, page_type, icon,
  content_json, sort_order, revision, created_at, updated_at`;
const TABLE_SELECT = `id, space_id, title, description, icon, revision, created_at, updated_at`;
const FIELD_SELECT = `id, table_id, name, field_type, config_json, sort_order,
  revision, created_at, updated_at`;
const RECORD_SELECT = `id, table_id, values_json, sort_order, revision,
  created_by_id, created_by_account, updated_by_id, updated_by_account,
  created_at, updated_at`;
const VIEW_SELECT = `id, table_id, name, view_type, filter_json, sort_json,
  group_json, visible_field_ids_json, row_height, frozen_field_count,
  is_default, revision, created_at, updated_at`;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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

function mapPage(row: PageRow): KnowledgePage {
  return {
    content: parseJson<Record<string, unknown>>(row.content_json, {}),
    createdAt: row.created_at,
    icon: row.icon,
    id: row.id,
    pageType: row.page_type as KnowledgePageType,
    parentId: row.parent_id ?? undefined,
    revision: Number(row.revision),
    slug: row.slug,
    sortOrder: Number(row.sort_order),
    spaceId: row.space_id,
    title: row.title,
    updatedAt: row.updated_at
  };
}

function mapTable(row: TableRow): KnowledgeTable {
  return {
    createdAt: row.created_at,
    description: row.description,
    icon: row.icon,
    id: row.id,
    revision: Number(row.revision),
    spaceId: row.space_id,
    title: row.title,
    updatedAt: row.updated_at
  };
}

function mapField(row: FieldRow): KnowledgeField {
  return {
    config: parseJson<Record<string, unknown>>(row.config_json, {}),
    createdAt: row.created_at,
    fieldType: row.field_type as KnowledgeFieldType,
    id: row.id,
    name: row.name,
    revision: Number(row.revision),
    sortOrder: Number(row.sort_order),
    tableId: row.table_id,
    updatedAt: row.updated_at
  };
}

function mapRecord(row: RecordRow): KnowledgeRecord {
  return {
    createdAt: row.created_at,
    createdByAccount: row.created_by_account ?? undefined,
    createdById: row.created_by_id ?? undefined,
    id: row.id,
    revision: Number(row.revision),
    sortOrder: Number(row.sort_order),
    tableId: row.table_id,
    updatedAt: row.updated_at,
    updatedByAccount: row.updated_by_account ?? undefined,
    updatedById: row.updated_by_id ?? undefined,
    values: parseJson<Record<string, unknown>>(row.values_json, {})
  };
}

function mapView(row: ViewRow): KnowledgeView {
  const rowHeight = ["compact", "medium", "tall"].includes(row.row_height)
    ? (row.row_height as KnowledgeView["rowHeight"])
    : "medium";

  return {
    createdAt: row.created_at,
    filter: parseJson<Record<string, unknown>>(row.filter_json, {}),
    frozenFieldCount: Number(row.frozen_field_count),
    group: parseJson<Record<string, unknown>>(row.group_json, {}),
    id: row.id,
    isDefault: Boolean(row.is_default),
    name: row.name,
    revision: Number(row.revision),
    rowHeight,
    sort: parseJson<unknown[]>(row.sort_json, []),
    tableId: row.table_id,
    updatedAt: row.updated_at,
    viewType: row.view_type as KnowledgeViewType,
    visibleFieldIds: parseJson<string[]>(row.visible_field_ids_json, []).filter(
      (item): item is string => typeof item === "string"
    )
  };
}

function conflict(resource: string): never {
  throw new KnowledgeValidationError(
    "REVISION_CONFLICT",
    `${resource}已被其他人更新，请刷新后重试。`,
    409
  );
}

function notFound(resource: string): never {
  throw new KnowledgeValidationError(
    "RESOURCE_NOT_FOUND",
    `${resource}不存在或已被删除。`,
    404
  );
}

function validateColor(value: unknown, fallback = "#7c3aed") {
  const color = value === undefined ? fallback : requiredString(value, "颜色", 32);

  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    throw new KnowledgeValidationError("INVALID_INPUT", "颜色必须是六位十六进制色值。");
  }

  return color.toLowerCase();
}

function safeIcon(value: unknown, fallback: string) {
  const icon = value === undefined ? fallback : requiredString(value, "图标", 32);

  if (!/^[a-z0-9-]{1,32}$/i.test(icon)) {
    throw new KnowledgeValidationError("INVALID_INPUT", "图标名称格式不正确。");
  }

  return icon;
}

async function lockSpace(db: Database, spaceId: string) {
  const row = await getFirstRow<SpaceRow>(
    db,
    `SELECT ${SPACE_SELECT} FROM knowledge_spaces WHERE id = ? FOR UPDATE`,
    [spaceId]
  );

  if (!row) {
    notFound("知识空间");
  }

  return row as SpaceRow;
}

async function lockTable(db: Database, tableId: string) {
  const current = await getFirstRow<TableRow>(
    db,
    `SELECT ${TABLE_SELECT} FROM knowledge_tables
     WHERE id = ? AND deleted_at IS NULL`,
    [tableId]
  );

  if (!current) {
    notFound("多维表格");
  }

  // All child writes lock their owning space first. This shares the same lock
  // order as space/table deletion and prevents late child inserts from becoming
  // orphaned while a space is being removed.
  await lockSpace(db, current.space_id);
  const row = await getFirstRow<TableRow>(
    db,
    `SELECT ${TABLE_SELECT} FROM knowledge_tables
     WHERE id = ? AND space_id = ? AND deleted_at IS NULL FOR UPDATE`,
    [tableId, current.space_id]
  );

  if (!row) {
    notFound("多维表格");
  }

  return row as TableRow;
}

async function assertParent(db: Database, spaceId: string, parentId: string | null) {
  if (!parentId) {
    return;
  }

  const parent = await getFirstRow<{ id: string }>(
    db,
    `SELECT id FROM knowledge_pages
     WHERE id = ? AND space_id = ? AND deleted_at IS NULL`,
    [parentId, spaceId]
  );

  if (!parent) {
    throw new KnowledgeValidationError(
      "INVALID_PARENT",
      "父页面不存在或不属于当前知识空间。",
      400
    );
  }
}

async function assertNoPageCycle(
  db: Database,
  spaceId: string,
  pageId: string,
  parentId: string | null
) {
  if (!parentId) {
    return;
  }

  if (parentId === pageId) {
    throw new KnowledgeValidationError("INVALID_PARENT", "页面不能成为自己的父页面。");
  }

  const pages = await getRows<{ id: string; parent_id: string | null }>(
    db,
    `SELECT id, parent_id FROM knowledge_pages
     WHERE space_id = ? AND deleted_at IS NULL`,
    [spaceId]
  );
  const parents = new Map(pages.map((page) => [page.id, page.parent_id]));
  let cursor: string | null = parentId;
  let depth = 0;

  while (cursor) {
    if (cursor === pageId) {
      throw new KnowledgeValidationError("INVALID_PARENT", "移动页面会形成循环层级。");
    }

    cursor = parents.get(cursor) ?? null;
    depth += 1;

    if (depth > 20) {
      throw new KnowledgeValidationError("INVALID_PARENT", "页面层级不能超过 20 层。");
    }
  }
}

async function uniquePageSlug(
  db: Database,
  spaceId: string,
  desired: string,
  excludeId?: string
) {
  const base = slugifyKnowledgePage(desired, randomUUID().slice(0, 8));

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = `${base.slice(0, 191 - suffix.length)}${suffix}`;
    const existing = await getFirstRow<{ id: string }>(
      db,
      `SELECT id FROM knowledge_pages
       WHERE space_id = ? AND slug = ?${excludeId ? " AND id <> ?" : ""}`,
      excludeId ? [spaceId, candidate, excludeId] : [spaceId, candidate]
    );

    if (!existing) {
      return candidate;
    }
  }

  throw new KnowledgeValidationError("RESOURCE_CONFLICT", "无法生成唯一页面地址。", 409);
}

function stableSeedId(ownerId: string, resource: string) {
  return `knowledge-${resource}-${createHash("sha256")
    .update(`${ownerId}:${resource}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export async function ensureDefaultKnowledgeWorkspace(actor: KnowledgeActor) {
  await ensureKnowledgeCollaborationSchema();

  return writeDatabase(async (db) => {
    const existing = await getFirstRow<{ id: string }>(
      db,
      "SELECT id FROM knowledge_spaces WHERE owner_id = ? LIMIT 1 FOR UPDATE",
      [actor.id]
    );

    if (existing) {
      return existing.id;
    }

    const now = new Date().toISOString();
    const spaceId = stableSeedId(actor.id, "space");

    await db.execute(
      `INSERT IGNORE INTO knowledge_spaces
       (id, owner_id, owner_account, title, description, icon, color, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        spaceId,
        actor.id,
        actor.account ?? null,
        "灵穹影视制作知识中枢",
        "沉淀影视项目方法、制作规范、角色场景资产、镜头排期与团队协作信息。",
        "book-open",
        "#7c3aed",
        now,
        now
      ]
    );
    await db.execute(
      `INSERT IGNORE INTO knowledge_space_members
       (id, space_id, user_id, account, member_role, revision, added_by_id,
        added_by_account, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'owner', 1, ?, ?, ?, ?)`,
      [
        stableSeedId(actor.id, "owner-member"),
        spaceId,
        actor.id,
        actor.account ?? null,
        actor.id,
        actor.account ?? null,
        now,
        now
      ]
    );

    const pageIds = {
      assetStandard: stableSeedId(actor.id, "page-asset-standard"),
      delivery: stableSeedId(actor.id, "page-delivery"),
      handbook: stableSeedId(actor.id, "page-handbook"),
      welcome: stableSeedId(actor.id, "page-welcome"),
      workflow: stableSeedId(actor.id, "page-workflow")
    };
    const pages: Array<{
      content: Record<string, unknown>;
      icon: string;
      id: string;
      parentId?: string;
      slug: string;
      sortOrder: number;
      title: string;
    }> = [
      {
        content: {
          blocks: [
            { level: 1, text: "灵穹影视制作知识中枢", type: "heading" },
            { text: "统一管理从立项、资产、镜头到审片交付的知识与数据。", type: "paragraph" },
            { text: "左侧是层级知识树，多维表格用于追踪可执行的制作任务。", tone: "purple", type: "callout" }
          ],
          version: 1
        },
        icon: "sparkles",
        id: pageIds.welcome,
        slug: "welcome",
        sortOrder: 0,
        title: "欢迎与工作台说明"
      },
      {
        content: {
          blocks: [
            { level: 1, text: "项目制作手册", type: "heading" },
            { items: ["立项与创作目标", "资产标准化", "镜头生产", "审片与交付"], type: "bulletList" }
          ],
          version: 1
        },
        icon: "book-open",
        id: pageIds.handbook,
        slug: "production-handbook",
        sortOrder: 10,
        title: "项目制作手册"
      },
      {
        content: {
          blocks: [
            { level: 1, text: "从剧本到成片", type: "heading" },
            { items: ["剧本锁定", "角色场景拆解", "分镜与提示词", "生成与合成", "审片"], type: "orderedList" }
          ],
          version: 1
        },
        icon: "workflow",
        id: pageIds.workflow,
        parentId: pageIds.handbook,
        slug: "creation-workflow",
        sortOrder: 0,
        title: "创作生产流程"
      },
      {
        content: {
          blocks: [
            { level: 1, text: "角色、场景与道具标准", type: "heading" },
            { text: "每项资产必须具备统一命名、视觉描述、参考素材、负责人和确认状态。", type: "paragraph" }
          ],
          version: 1
        },
        icon: "palette",
        id: pageIds.assetStandard,
        parentId: pageIds.handbook,
        slug: "asset-standard",
        sortOrder: 10,
        title: "资产命名与视觉标准"
      },
      {
        content: {
          blocks: [
            { level: 1, text: "审片与交付清单", type: "heading" },
            { items: ["画面连续性", "角色一致性", "字幕与声音", "版权与授权", "交付规格"], type: "checklist" }
          ],
          version: 1
        },
        icon: "circle-check",
        id: pageIds.delivery,
        parentId: pageIds.handbook,
        slug: "review-delivery",
        sortOrder: 20,
        title: "审片与交付清单"
      }
    ];

    for (const page of pages) {
      await db.execute(
        `INSERT IGNORE INTO knowledge_pages
         (id, space_id, parent_id, title, slug, page_type, icon, content_json,
          sort_order, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'document', ?, ?, ?, 1, ?, ?)`,
        [page.id, spaceId, page.parentId ?? null, page.title, page.slug, page.icon, JSON.stringify(page.content), page.sortOrder, now, now]
      );
      await recordKnowledgePageVersion(db, {
        actor,
        changeSummary: "初始化制作知识库",
        content: page.content,
        pageId: page.id,
        pageRevision: 1,
        spaceId,
        title: page.title
      });
    }

    const assetTableId = stableSeedId(actor.id, "table-assets");
    const shotTableId = stableSeedId(actor.id, "table-shots");
    await db.execute(
      `INSERT IGNORE INTO knowledge_tables
       (id, space_id, title, description, icon, revision, created_at, updated_at)
       VALUES (?, ?, '影视资产中心', '管理人物、场景、道具与主视觉资产。', 'images', 1, ?, ?),
              (?, ?, '镜头制作排期', '跟踪分镜、生成、合成与审片进度。', 'clapperboard', 1, ?, ?)`,
      [assetTableId, spaceId, now, now, shotTableId, spaceId, now, now]
    );

    const assetFields = {
      deadline: stableSeedId(actor.id, "asset-deadline"),
      name: stableSeedId(actor.id, "asset-name"),
      owner: stableSeedId(actor.id, "asset-owner"),
      progress: stableSeedId(actor.id, "asset-progress"),
      status: stableSeedId(actor.id, "asset-status"),
      tags: stableSeedId(actor.id, "asset-tags"),
      type: stableSeedId(actor.id, "asset-type")
    };
    const shotFields = {
      date: stableSeedId(actor.id, "shot-date"),
      duration: stableSeedId(actor.id, "shot-duration"),
      episode: stableSeedId(actor.id, "shot-episode"),
      name: stableSeedId(actor.id, "shot-name"),
      owner: stableSeedId(actor.id, "shot-owner"),
      progress: stableSeedId(actor.id, "shot-progress"),
      scene: stableSeedId(actor.id, "shot-scene"),
      status: stableSeedId(actor.id, "shot-status")
    };
    const commonStatus = {
      options: [
        { color: "gray", label: "待开始" },
        { color: "blue", label: "制作中" },
        { color: "orange", label: "待审核" },
        { color: "green", label: "已完成" }
      ]
    };
    const fieldSeed: Array<[string, string, string, KnowledgeFieldType, Record<string, unknown>, number]> = [
      [assetFields.name, assetTableId, "资产名称", "text", { required: true }, 0],
      [assetFields.type, assetTableId, "资产类型", "select", { options: [{ color: "purple", label: "人物" }, { color: "blue", label: "场景" }, { color: "orange", label: "道具" }, { color: "pink", label: "主视觉" }] }, 10],
      [assetFields.status, assetTableId, "制作状态", "select", commonStatus, 20],
      [assetFields.owner, assetTableId, "负责人", "person", {}, 30],
      [assetFields.deadline, assetTableId, "计划日期", "date", { includeTime: false }, 40],
      [assetFields.progress, assetTableId, "完成度", "progress", { max: 100 }, 50],
      [assetFields.tags, assetTableId, "标签", "multi_select", { options: [] }, 60],
      [shotFields.name, shotTableId, "镜头任务", "text", { required: true }, 0],
      [shotFields.episode, shotTableId, "集数", "number", { decimals: 0 }, 10],
      [shotFields.scene, shotTableId, "场景", "text", {}, 20],
      [shotFields.status, shotTableId, "状态", "select", commonStatus, 30],
      [shotFields.owner, shotTableId, "负责人", "person", {}, 40],
      [shotFields.date, shotTableId, "计划日期", "date", { includeTime: false }, 50],
      [shotFields.duration, shotTableId, "时长（秒）", "number", { decimals: 1 }, 60],
      [shotFields.progress, shotTableId, "完成度", "progress", { max: 100 }, 70]
    ];
    for (const [id, tableId, name, fieldType, config, sortOrder] of fieldSeed) {
      await db.execute(
        `INSERT IGNORE INTO knowledge_fields
         (id, table_id, name, field_type, config_json, sort_order, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, tableId, name, fieldType, JSON.stringify(config), sortOrder, now, now]
      );
    }

    const owner = actor.account ?? "创作负责人";
    const assetRecords: Array<Record<string, unknown>> = [
      { [assetFields.name]: "沈砚｜主角定妆", [assetFields.type]: "人物", [assetFields.status]: "已完成", [assetFields.owner]: owner, [assetFields.deadline]: "2026-07-15", [assetFields.progress]: 100, [assetFields.tags]: ["核心角色", "定妆"] },
      { [assetFields.name]: "林澜｜调查记者", [assetFields.type]: "人物", [assetFields.status]: "待审核", [assetFields.owner]: owner, [assetFields.deadline]: "2026-07-18", [assetFields.progress]: 80, [assetFields.tags]: ["主要角色"] },
      { [assetFields.name]: "雨夜老街", [assetFields.type]: "场景", [assetFields.status]: "制作中", [assetFields.owner]: owner, [assetFields.deadline]: "2026-07-20", [assetFields.progress]: 55, [assetFields.tags]: ["夜景", "外景"] },
      { [assetFields.name]: "灵穹实验室", [assetFields.type]: "场景", [assetFields.status]: "待审核", [assetFields.owner]: owner, [assetFields.deadline]: "2026-07-21", [assetFields.progress]: 75, [assetFields.tags]: ["室内", "科幻"] },
      { [assetFields.name]: "青铜密钥", [assetFields.type]: "道具", [assetFields.status]: "已完成", [assetFields.owner]: owner, [assetFields.deadline]: "2026-07-16", [assetFields.progress]: 100, [assetFields.tags]: ["关键道具"] },
      { [assetFields.name]: "第一集主视觉", [assetFields.type]: "主视觉", [assetFields.status]: "待开始", [assetFields.owner]: owner, [assetFields.deadline]: "2026-07-24", [assetFields.progress]: 10, [assetFields.tags]: ["宣发"] }
    ];
    const shotRecords: Array<Record<string, unknown>> = [
      { [shotFields.name]: "S01 雨夜追踪开场", [shotFields.episode]: 1, [shotFields.scene]: "雨夜老街", [shotFields.status]: "待审核", [shotFields.owner]: owner, [shotFields.date]: "2026-07-18", [shotFields.duration]: 10, [shotFields.progress]: 85 },
      { [shotFields.name]: "S02 密钥特写", [shotFields.episode]: 1, [shotFields.scene]: "雨夜老街", [shotFields.status]: "已完成", [shotFields.owner]: owner, [shotFields.date]: "2026-07-18", [shotFields.duration]: 6, [shotFields.progress]: 100 },
      { [shotFields.name]: "S03 实验室对峙", [shotFields.episode]: 1, [shotFields.scene]: "灵穹实验室", [shotFields.status]: "制作中", [shotFields.owner]: owner, [shotFields.date]: "2026-07-20", [shotFields.duration]: 12, [shotFields.progress]: 60 },
      { [shotFields.name]: "S04 林澜发现线索", [shotFields.episode]: 1, [shotFields.scene]: "资料室", [shotFields.status]: "待开始", [shotFields.owner]: owner, [shotFields.date]: "2026-07-21", [shotFields.duration]: 8, [shotFields.progress]: 15 },
      { [shotFields.name]: "S05 片尾悬念", [shotFields.episode]: 1, [shotFields.scene]: "城市天台", [shotFields.status]: "待开始", [shotFields.owner]: owner, [shotFields.date]: "2026-07-22", [shotFields.duration]: 9, [shotFields.progress]: 5 }
    ];
    for (const [tableId, records] of [[assetTableId, assetRecords], [shotTableId, shotRecords]] as const) {
      for (let index = 0; index < records.length; index += 1) {
        const recordId = stableSeedId(actor.id, `${tableId}-record-${index + 1}`);
        await db.execute(
          `INSERT IGNORE INTO knowledge_records
           (id, table_id, values_json, sort_order, revision, created_by_id,
            created_by_account, updated_by_id, updated_by_account, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
          [recordId, tableId, JSON.stringify(records[index]), index * 10, actor.id, actor.account ?? null, actor.id, actor.account ?? null, now, now]
        );
        await recordKnowledgeActivity(db, {
          action: "seeded",
          actor,
          details: { template: "影视制作知识中枢" },
          recordId,
          tableId
        });
      }
    }

    const assetVisible = JSON.stringify(Object.values(assetFields));
    const shotVisible = JSON.stringify(Object.values(shotFields));
    const viewSeed: Array<[string, string, string, KnowledgeViewType, Record<string, unknown>, unknown[], Record<string, unknown>, string, number]> = [
      [stableSeedId(actor.id, "asset-view-grid"), assetTableId, "全部资产", "grid", {}, [{ direction: "asc", fieldId: assetFields.type }], {}, assetVisible, 1],
      [stableSeedId(actor.id, "asset-view-kanban"), assetTableId, "按状态看板", "kanban", {}, [], { fieldId: assetFields.status }, assetVisible, 0],
      [stableSeedId(actor.id, "asset-view-calendar"), assetTableId, "资产日历", "calendar", {}, [], { fieldId: assetFields.deadline }, assetVisible, 0],
      [stableSeedId(actor.id, "asset-view-gallery"), assetTableId, "资产画册", "gallery", {}, [], { titleFieldId: assetFields.name }, assetVisible, 0],
      [stableSeedId(actor.id, "shot-view-grid"), shotTableId, "镜头总表", "grid", {}, [{ direction: "asc", fieldId: shotFields.date }], {}, shotVisible, 1],
      [stableSeedId(actor.id, "shot-view-gantt"), shotTableId, "制作甘特", "gantt", {}, [], { dateFieldId: shotFields.date }, shotVisible, 0]
    ];
    for (const [id, tableId, name, viewType, filter, sort, group, visibleIds, isDefault] of viewSeed) {
      await db.execute(
        `INSERT IGNORE INTO knowledge_views
         (id, table_id, name, view_type, filter_json, sort_json, group_json,
          visible_field_ids_json, row_height, frozen_field_count, is_default,
          revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'medium', 1, ?, 1, ?, ?)`,
        [id, tableId, name, viewType, JSON.stringify(filter), JSON.stringify(sort), JSON.stringify(group), visibleIds, isDefault, now, now]
      );
    }

    return spaceId;
  });
}

export async function listKnowledgeSpaces(ownerId?: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const rows = await getRows<SpaceRow>(
      db,
      `SELECT ${SPACE_SELECT} FROM knowledge_spaces
       ${ownerId ? "WHERE owner_id = ?" : ""}
       ORDER BY updated_at DESC, created_at DESC`,
      ownerId ? [ownerId] : []
    );
    return rows.map(mapSpace);
  });
}

export async function getKnowledgeSpace(id: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<SpaceRow>(
      db,
      `SELECT ${SPACE_SELECT} FROM knowledge_spaces WHERE id = ?`,
      [id]
    );
    return row ? mapSpace(row) : null;
  });
}

export async function createKnowledgeSpace(actor: KnowledgeActor, input: Record<string, unknown>) {
  await ensureKnowledgeCollaborationSchema();
  const now = new Date().toISOString();
  const space: KnowledgeSpace = {
    color: validateColor(input.color),
    createdAt: now,
    description: optionalString(input.description, "空间描述", 2000) ?? "",
    icon: safeIcon(input.icon, "book-open"),
    id: randomUUID(),
    ownerAccount: actor.account,
    ownerId: actor.id,
    revision: 1,
    title: requiredString(input.title, "空间名称", 255),
    updatedAt: now
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO knowledge_spaces
       (id, owner_id, owner_account, title, description, icon, color, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [space.id, space.ownerId, space.ownerAccount ?? null, space.title, space.description, space.icon, space.color, now, now]
    );
    await db.execute(
      `INSERT INTO knowledge_space_members
       (id, space_id, user_id, account, member_role, revision, added_by_id,
        added_by_account, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'owner', 1, ?, ?, ?, ?)`,
      [
        stableSeedId(actor.id, `owner-member-${space.id}`),
        space.id,
        actor.id,
        actor.account ?? null,
        actor.id,
        actor.account ?? null,
        now,
        now
      ]
    );
  });
  return space;
}

export async function updateKnowledgeSpace(id: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    const currentRow = await lockSpace(db, id);
    const current = mapSpace(currentRow);

    if (current.revision !== revision) {
      conflict("知识空间");
    }

    const now = new Date().toISOString();
    const next = {
      color: input.color === undefined ? current.color : validateColor(input.color),
      description: optionalString(input.description, "空间描述", 2000) ?? current.description,
      icon: input.icon === undefined ? current.icon : safeIcon(input.icon, current.icon),
      title: optionalString(input.title, "空间名称", 255) ?? current.title
    };

    if (!next.title) {
      throw new KnowledgeValidationError("INVALID_INPUT", "空间名称不能为空。");
    }

    const result = await db.execute(
      `UPDATE knowledge_spaces SET title = ?, description = ?, icon = ?, color = ?,
       revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?`,
      [next.title, next.description, next.icon, next.color, now, id, revision]
    );

    if (!result.affectedRows) conflict("知识空间");
    return { ...current, ...next, revision: revision + 1, updatedAt: now };
  });
}

export async function deleteKnowledgeSpace(id: string, revision: number) {
  await ensureKnowledgeCollaborationSchema();
  const deleted = await writeDatabase(async (db) => {
    const current = await lockSpace(db, id);
    if (Number(current.revision) !== revision) conflict("知识空间");

    await db.execute(
      `DELETE ar FROM knowledge_automation_runs ar
       INNER JOIN knowledge_tables t ON t.id = ar.table_id WHERE t.space_id = ?`,
      [id]
    );
    await db.execute(
      `DELETE au FROM knowledge_automation_rules au
       INNER JOIN knowledge_tables t ON t.id = au.table_id WHERE t.space_id = ?`,
      [id]
    );
    await db.execute(
      `DELETE rc FROM knowledge_record_comments rc
       INNER JOIN knowledge_tables t ON t.id = rc.table_id WHERE t.space_id = ?`,
      [id]
    );
    await db.execute(
      `DELETE ra FROM knowledge_record_activities ra
       INNER JOIN knowledge_tables t ON t.id = ra.table_id WHERE t.space_id = ?`,
      [id]
    );
    await db.execute("DELETE FROM knowledge_page_comments WHERE space_id = ?", [id]);
    await db.execute("DELETE FROM knowledge_page_versions WHERE space_id = ?", [id]);
    await db.execute("DELETE FROM knowledge_space_members WHERE space_id = ?", [id]);
    await db.execute(
      `DELETE v FROM knowledge_views v INNER JOIN knowledge_tables t ON t.id = v.table_id WHERE t.space_id = ?`,
      [id]
    );
    await db.execute(
      `DELETE r FROM knowledge_records r INNER JOIN knowledge_tables t ON t.id = r.table_id WHERE t.space_id = ?`,
      [id]
    );
    await db.execute(
      `DELETE f FROM knowledge_fields f INNER JOIN knowledge_tables t ON t.id = f.table_id WHERE t.space_id = ?`,
      [id]
    );
    await db.execute("DELETE FROM knowledge_tables WHERE space_id = ?", [id]);
    await db.execute("DELETE FROM knowledge_pages WHERE space_id = ?", [id]);
    const result = await db.execute(
      "DELETE FROM knowledge_spaces WHERE id = ? AND revision = ?",
      [id, revision]
    );
    if (!result.affectedRows) conflict("知识空间");
    return true;
  });
  await purgeKnowledgeSpaceAttachments(id).catch((error) => {
    console.error("Failed to purge deleted knowledge space attachments", error);
  });
  return deleted;
}

export async function listKnowledgePages(spaceId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) =>
    (await getRows<PageRow>(db, `SELECT ${PAGE_SELECT} FROM knowledge_pages WHERE space_id = ? AND deleted_at IS NULL ORDER BY parent_id, sort_order, created_at`, [spaceId])).map(mapPage)
  );
}

export async function getKnowledgePage(spaceId: string, pageId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<PageRow>(db, `SELECT ${PAGE_SELECT} FROM knowledge_pages WHERE space_id = ? AND id = ? AND deleted_at IS NULL`, [spaceId, pageId]);
    return row ? mapPage(row) : null;
  });
}

export async function createKnowledgePage(
  spaceId: string,
  input: Record<string, unknown>,
  actor?: KnowledgeActor
) {
  await ensureKnowledgeCollaborationSchema();
  const title = requiredString(input.title, "页面标题", 255);
  const parentId = optionalNullableId(input.parentId, "父页面") ?? null;
  const content = input.content === undefined ? { blocks: [], version: 1 } : jsonValue(input.content, "页面内容", { maxBytes: 1024 * 1024, objectOnly: true }) as Record<string, unknown>;
  const pageType = enumValue(input.pageType, "页面类型", knowledgePageTypes, "document");
  const now = new Date().toISOString();

  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    await assertParent(db, spaceId, parentId);
    const page: KnowledgePage = {
      content,
      createdAt: now,
      icon: safeIcon(input.icon, pageType === "table" ? "table-2" : "file-text"),
      id: randomUUID(),
      pageType,
      parentId: parentId ?? undefined,
      revision: 1,
      slug: await uniquePageSlug(db, spaceId, optionalString(input.slug, "页面地址", 191) || title),
      sortOrder: optionalInteger(input.sortOrder, "排序", { min: 0 }) ?? 0,
      spaceId,
      title,
      updatedAt: now
    };
    await db.execute(
      `INSERT INTO knowledge_pages
       (id, space_id, parent_id, title, slug, page_type, icon, content_json, sort_order, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [page.id, spaceId, parentId, title, page.slug, pageType, page.icon, JSON.stringify(content), page.sortOrder, now, now]
    );
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    await recordKnowledgePageVersion(db, {
      actor,
      changeSummary: optionalString(input.changeSummary, "变更说明", 1000) ?? "创建页面",
      content,
      pageId: page.id,
      pageRevision: 1,
      spaceId,
      title
    });
    return page;
  });
}

export async function updateKnowledgePage(
  spaceId: string,
  pageId: string,
  input: Record<string, unknown>,
  actor?: KnowledgeActor
) {
  await ensureKnowledgeCollaborationSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const row = await getFirstRow<PageRow>(db, `SELECT ${PAGE_SELECT} FROM knowledge_pages WHERE space_id = ? AND id = ? AND deleted_at IS NULL FOR UPDATE`, [spaceId, pageId]);
    if (!row) notFound("页面");
    const current = mapPage(row as PageRow);
    if (current.revision !== revision) conflict("页面");

    const parentId = optionalNullableId(input.parentId, "父页面");
    const nextParentId = parentId === undefined ? current.parentId ?? null : parentId;
    await assertParent(db, spaceId, nextParentId);
    await assertNoPageCycle(db, spaceId, pageId, nextParentId);

    const title = optionalString(input.title, "页面标题", 255) ?? current.title;
    if (!title) throw new KnowledgeValidationError("INVALID_INPUT", "页面标题不能为空。");
    const requestedSlug = optionalString(input.slug, "页面地址", 191);
    const slug = requestedSlug === undefined ? current.slug : await uniquePageSlug(db, spaceId, requestedSlug || title, pageId);
    const content = input.content === undefined ? current.content : jsonValue(input.content, "页面内容", { maxBytes: 1024 * 1024, objectOnly: true }) as Record<string, unknown>;
    const pageType = input.pageType === undefined ? current.pageType : enumValue(input.pageType, "页面类型", knowledgePageTypes);
    const icon = input.icon === undefined ? current.icon : safeIcon(input.icon, current.icon);
    const sortOrder = optionalInteger(input.sortOrder, "排序", { min: 0 }) ?? current.sortOrder;
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_pages SET parent_id = ?, title = ?, slug = ?, page_type = ?, icon = ?,
       content_json = ?, sort_order = ?, revision = revision + 1, updated_at = ?
       WHERE id = ? AND space_id = ? AND revision = ? AND deleted_at IS NULL`,
      [nextParentId, title, slug, pageType, icon, JSON.stringify(content), sortOrder, now, pageId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("页面");
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    await recordKnowledgePageVersion(db, {
      actor,
      changeSummary: optionalString(input.changeSummary, "变更说明", 1000) ?? "更新页面",
      content,
      pageId,
      pageRevision: revision + 1,
      spaceId,
      title
    });
    return { ...current, content, icon, pageType, parentId: nextParentId ?? undefined, revision: revision + 1, slug, sortOrder, title, updatedAt: now };
  });
}

export async function reorderKnowledgePages(spaceId: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 500) {
    throw new KnowledgeValidationError("INVALID_INPUT", "items 必须包含 1 到 500 个页面排序项。");
  }
  const items = input.items.map((value) => {
    if (!isPlainObject(value)) throw new KnowledgeValidationError("INVALID_INPUT", "页面排序项格式不正确。");
    return {
      id: requiredString(value.id, "页面 ID", 191),
      parentId: optionalNullableId(value.parentId, "父页面") ?? null,
      revision: requiredRevision(value.revision),
      sortOrder: optionalInteger(value.sortOrder, "排序", { min: 0 }) ?? 0
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new KnowledgeValidationError("INVALID_INPUT", "页面排序项不能重复。");
  }

  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const allPages = await getRows<PageRow>(
      db,
      `SELECT ${PAGE_SELECT} FROM knowledge_pages WHERE space_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [spaceId]
    );
    const pageMap = new Map(allPages.map((page) => [page.id, page]));
    const plannedParents = new Map(
      allPages.map((page) => [page.id, page.parent_id] as const)
    );

    for (const item of items) {
      const row = pageMap.get(item.id);
      if (!row) notFound("页面");
      if (Number(row.revision) !== item.revision) conflict("页面");
      if (item.parentId && !pageMap.has(item.parentId)) {
        throw new KnowledgeValidationError(
          "INVALID_PARENT",
          "父页面不存在或不属于当前知识空间。"
        );
      }
      plannedParents.set(item.id, item.parentId);
    }

    for (const page of allPages) {
      let cursor: string | null = page.id;
      const visited = new Set<string>();
      let depth = 0;

      while (cursor) {
        if (visited.has(cursor)) {
          throw new KnowledgeValidationError(
            "INVALID_PARENT",
            "页面排序会形成循环层级。"
          );
        }
        visited.add(cursor);
        cursor = plannedParents.get(cursor) ?? null;
        depth += 1;
        if (depth > 20) {
          throw new KnowledgeValidationError(
            "INVALID_PARENT",
            "页面层级不能超过 20 层。"
          );
        }
      }
    }
    const now = new Date().toISOString();
    for (const item of items) {
      const result = await db.execute(
        `UPDATE knowledge_pages SET parent_id = ?, sort_order = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND space_id = ? AND revision = ? AND deleted_at IS NULL`,
        [item.parentId, item.sortOrder, now, item.id, spaceId, item.revision]
      );
      if (!result.affectedRows) conflict("页面");
    }
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    return listPagesWithDatabase(db, spaceId);
  });
}

async function listPagesWithDatabase(db: Database, spaceId: string) {
  return (await getRows<PageRow>(db, `SELECT ${PAGE_SELECT} FROM knowledge_pages WHERE space_id = ? AND deleted_at IS NULL ORDER BY parent_id, sort_order, created_at`, [spaceId])).map(mapPage);
}

export async function deleteKnowledgePage(
  spaceId: string,
  pageId: string,
  revision: number,
  actor: KnowledgeActor
) {
  return moveKnowledgePageToTrash(spaceId, pageId, revision, actor);
}

export async function listKnowledgeTables(spaceId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) =>
    (await getRows<TableRow>(db, `SELECT ${TABLE_SELECT} FROM knowledge_tables WHERE space_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`, [spaceId])).map(mapTable)
  );
}

export async function getKnowledgeTable(spaceId: string, tableId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<TableRow>(db, `SELECT ${TABLE_SELECT} FROM knowledge_tables WHERE space_id = ? AND id = ? AND deleted_at IS NULL`, [spaceId, tableId]);
    return row ? mapTable(row) : null;
  });
}

export async function createKnowledgeTable(spaceId: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  const now = new Date().toISOString();
  const primaryFieldId = randomUUID();
  const defaultViewId = randomUUID();
  const table: KnowledgeTable = {
    createdAt: now,
    description: optionalString(input.description, "表格描述", 2000) ?? "",
    icon: safeIcon(input.icon, "table-2"),
    id: randomUUID(),
    revision: 1,
    spaceId,
    title: requiredString(input.title, "表格名称", 255),
    updatedAt: now
  };
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    await db.execute(
      `INSERT INTO knowledge_tables (id, space_id, title, description, icon, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [table.id, spaceId, table.title, table.description, table.icon, now, now]
    );
    await db.execute(
      `INSERT INTO knowledge_fields
       (id, table_id, name, field_type, config_json, sort_order, revision, created_at, updated_at)
       VALUES (?, ?, '名称', 'text', ?, 0, 1, ?, ?)`,
      [primaryFieldId, table.id, JSON.stringify({ primary: true, required: true }), now, now]
    );
    await db.execute(
      `INSERT INTO knowledge_views
       (id, table_id, name, view_type, filter_json, sort_json, group_json,
        visible_field_ids_json, row_height, frozen_field_count, is_default,
        revision, created_at, updated_at)
       VALUES (?, ?, '全部记录', 'grid', '{}', '[]', '{}', ?, 'medium', 1, 1, 1, ?, ?)`,
      [defaultViewId, table.id, JSON.stringify([primaryFieldId]), now, now]
    );
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    return table;
  });
}

export async function updateKnowledgeTable(spaceId: string, tableId: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    await lockSpace(db, spaceId);
    const row = await getFirstRow<TableRow>(db, `SELECT ${TABLE_SELECT} FROM knowledge_tables WHERE space_id = ? AND id = ? AND deleted_at IS NULL FOR UPDATE`, [spaceId, tableId]);
    if (!row) notFound("多维表格");
    const current = mapTable(row as TableRow);
    if (current.revision !== revision) conflict("多维表格");
    const title = optionalString(input.title, "表格名称", 255) ?? current.title;
    if (!title) throw new KnowledgeValidationError("INVALID_INPUT", "表格名称不能为空。");
    const next = {
      description: optionalString(input.description, "表格描述", 2000) ?? current.description,
      icon: input.icon === undefined ? current.icon : safeIcon(input.icon, current.icon),
      title
    };
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_tables SET title = ?, description = ?, icon = ?, revision = revision + 1,
       updated_at = ? WHERE id = ? AND space_id = ? AND revision = ? AND deleted_at IS NULL`,
      [next.title, next.description, next.icon, now, tableId, spaceId, revision]
    );
    if (!result.affectedRows) conflict("多维表格");
    await db.execute("UPDATE knowledge_spaces SET updated_at = ? WHERE id = ?", [now, spaceId]);
    return { ...current, ...next, revision: revision + 1, updatedAt: now };
  });
}

export async function deleteKnowledgeTable(
  spaceId: string,
  tableId: string,
  revision: number,
  actor: KnowledgeActor
) {
  return moveKnowledgeTableToTrash(spaceId, tableId, revision, actor);
}

export async function listKnowledgeFields(tableId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) =>
    (await getRows<FieldRow>(db, `SELECT ${FIELD_SELECT} FROM knowledge_fields WHERE table_id = ? ORDER BY sort_order, created_at`, [tableId])).map(mapField)
  );
}

export async function getKnowledgeField(tableId: string, fieldId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<FieldRow>(db, `SELECT ${FIELD_SELECT} FROM knowledge_fields WHERE table_id = ? AND id = ?`, [tableId, fieldId]);
    return row ? mapField(row) : null;
  });
}

function fieldConfig(value: unknown) {
  return (value === undefined ? {} : jsonValue(value, "字段配置", { maxBytes: 128 * 1024, objectOnly: true })) as Record<string, unknown>;
}

export async function createKnowledgeField(tableId: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  const now = new Date().toISOString();
  const field: KnowledgeField = {
    config: fieldConfig(input.config),
    createdAt: now,
    fieldType: enumValue(input.fieldType, "字段类型", knowledgeFieldTypes),
    id: randomUUID(),
    name: requiredString(input.name, "字段名称", 255),
    revision: 1,
    sortOrder: optionalInteger(input.sortOrder, "排序", { min: 0 }) ?? 0,
    tableId,
    updatedAt: now
  };
  await writeDatabase(async (db) => {
    await lockTable(db, tableId);
    await db.execute(
      `INSERT INTO knowledge_fields (id, table_id, name, field_type, config_json, sort_order, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [field.id, tableId, field.name, field.fieldType, JSON.stringify(field.config), field.sortOrder, now, now]
    );
  });
  return field;
}

export async function updateKnowledgeField(tableId: string, fieldId: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<FieldRow>(db, `SELECT ${FIELD_SELECT} FROM knowledge_fields WHERE table_id = ? AND id = ? FOR UPDATE`, [tableId, fieldId]);
    if (!row) notFound("字段");
    const current = mapField(row as FieldRow);
    if (current.revision !== revision) conflict("字段");
    const name = optionalString(input.name, "字段名称", 255) ?? current.name;
    if (!name) throw new KnowledgeValidationError("INVALID_INPUT", "字段名称不能为空。");
    const next = {
      config: input.config === undefined ? current.config : fieldConfig(input.config),
      fieldType: input.fieldType === undefined ? current.fieldType : enumValue(input.fieldType, "字段类型", knowledgeFieldTypes),
      name,
      sortOrder: optionalInteger(input.sortOrder, "排序", { min: 0 }) ?? current.sortOrder
    };
    if (current.config.primary === true) {
      if (next.fieldType !== "text") {
        throw new KnowledgeValidationError(
          "PRIMARY_FIELD_TYPE_REQUIRED",
          "主字段必须保持文本类型。",
          409
        );
      }
      if (next.config.primary !== true || next.config.required !== true) {
        throw new KnowledgeValidationError(
          "PRIMARY_FIELD_REQUIRED",
          "主字段必须保留 primary 和 required 配置。",
          409
        );
      }
    }
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_fields SET name = ?, field_type = ?, config_json = ?, sort_order = ?,
       revision = revision + 1, updated_at = ? WHERE id = ? AND table_id = ? AND revision = ?`,
      [next.name, next.fieldType, JSON.stringify(next.config), next.sortOrder, now, fieldId, tableId, revision]
    );
    if (!result.affectedRows) conflict("字段");
    return { ...current, ...next, revision: revision + 1, updatedAt: now };
  });
}

export async function deleteKnowledgeField(tableId: string, fieldId: string, revision: number) {
  await ensureKnowledgeSchema();
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<FieldRow>(db, `SELECT ${FIELD_SELECT} FROM knowledge_fields WHERE table_id = ? AND id = ? FOR UPDATE`, [tableId, fieldId]);
    if (!row) notFound("字段");
    const field = mapField(row as FieldRow);
    if (field.config.primary === true) {
      throw new KnowledgeValidationError(
        "PRIMARY_FIELD_REQUIRED",
        "主字段不能删除。",
        409
      );
    }
    if (field.revision !== revision) conflict("字段");
    const result = await db.execute("DELETE FROM knowledge_fields WHERE table_id = ? AND id = ? AND revision = ?", [tableId, fieldId, revision]);
    if (!result.affectedRows) conflict("字段");
    const records = await getRows<{ id: string; values_json: string }>(db, "SELECT id, values_json FROM knowledge_records WHERE table_id = ? FOR UPDATE", [tableId]);
    for (const record of records) {
      const values = parseJson<Record<string, unknown>>(record.values_json, {});
      if (Object.prototype.hasOwnProperty.call(values, fieldId)) {
        delete values[fieldId];
        await db.execute("UPDATE knowledge_records SET values_json = ?, revision = revision + 1, updated_at = ? WHERE id = ?", [JSON.stringify(values), new Date().toISOString(), record.id]);
      }
    }
    const views = await getRows<{ id: string; visible_field_ids_json: string }>(
      db,
      "SELECT id, visible_field_ids_json FROM knowledge_views WHERE table_id = ? FOR UPDATE",
      [tableId]
    );
    for (const view of views) {
      const visible = parseJson<string[]>(view.visible_field_ids_json, []).filter(
        (id) => id !== fieldId
      );
      await db.execute(
        `UPDATE knowledge_views SET visible_field_ids_json = ?, revision = revision + 1,
         updated_at = ? WHERE id = ?`,
        [JSON.stringify(visible), new Date().toISOString(), view.id]
      );
    }
    return true;
  });
}

async function validateRecordValues(db: Database, tableId: string, value: unknown) {
  const values = jsonValue(value, "记录数据", { maxBytes: 512 * 1024, objectOnly: true }) as Record<string, unknown>;
  const fields = await getRows<{
    config_json: string;
    field_type: string;
    id: string;
    name: string;
  }>(
    db,
    "SELECT id, name, field_type, config_json FROM knowledge_fields WHERE table_id = ?",
    [tableId]
  );
  const fieldMap = new Map(fields.map((field) => [field.id, field.field_type]));

  for (const [fieldId, fieldValue] of Object.entries(values)) {
    const fieldType = fieldMap.get(fieldId);
    if (!fieldType) {
      throw new KnowledgeValidationError("INVALID_FIELD", `字段 ${fieldId} 不属于当前表格。`);
    }
    if (fieldValue === null || fieldValue === "") continue;
    if (["autonumber", "created_time", "updated_time"].includes(fieldType)) {
      throw new KnowledgeValidationError(
        "INVALID_FIELD_VALUE",
        `字段 ${fieldId} 是只读字段。`
      );
    }
    if (
      ["currency", "number", "progress", "rating"].includes(fieldType) &&
      (typeof fieldValue !== "number" || !Number.isFinite(fieldValue))
    ) {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须是数值。`);
    }
    if (fieldType === "checkbox" && typeof fieldValue !== "boolean") {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须是布尔值。`);
    }
    if (["multi_select", "attachment"].includes(fieldType) && !Array.isArray(fieldValue)) {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须是数组。`);
    }
    if (
      [
        "barcode",
        "button",
        "date",
        "email",
        "formula",
        "location",
        "lookup",
        "person",
        "phone",
        "relation",
        "select",
        "text",
        "url"
      ].includes(fieldType) &&
      typeof fieldValue !== "string"
    ) {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须是文本。`);
    }
    if (fieldType === "url" && typeof fieldValue === "string" && !/^https?:\/\//i.test(fieldValue)) {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须是 HTTP(S) 地址。`);
    }
    if (fieldType === "email" && typeof fieldValue === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue)) {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须是邮箱地址。`);
    }
    if (fieldType === "progress" && typeof fieldValue === "number" && (fieldValue < 0 || fieldValue > 100)) {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须在 0 到 100 之间。`);
    }
    if (fieldType === "rating" && typeof fieldValue === "number" && (fieldValue < 0 || fieldValue > 5)) {
      throw new KnowledgeValidationError("INVALID_FIELD_VALUE", `字段 ${fieldId} 必须在 0 到 5 之间。`);
    }
  }
  for (const field of fields) {
    const config = parseJson<Record<string, unknown>>(field.config_json, {});
    if (config.required !== true) continue;
    const value = values[field.id];
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      throw new KnowledgeValidationError(
        "REQUIRED_FIELD_MISSING",
        `必填字段“${field.name}”不能为空。`
      );
    }
  }
  return values;
}

export async function listKnowledgeRecords(
  tableId: string,
  limit = 500,
  offset = 0
) {
  await ensureKnowledgeSchema();
  const boundedLimit = Math.max(1, Math.min(5001, Math.floor(limit)));
  const boundedOffset = Math.max(0, Math.min(1_000_000, Math.floor(offset)));
  return readDatabase(async (db) =>
    (await getRows<RecordRow>(db, `SELECT ${RECORD_SELECT} FROM knowledge_records WHERE table_id = ? ORDER BY sort_order, created_at LIMIT ${boundedLimit} OFFSET ${boundedOffset}`, [tableId])).map(mapRecord)
  );
}

export async function countKnowledgeRecords(tableId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<{ total: number }>(
      db,
      "SELECT COUNT(*) AS total FROM knowledge_records WHERE table_id = ?",
      [tableId]
    );
    return Number(row?.total ?? 0);
  });
}

export async function getKnowledgeRecord(tableId: string, recordId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<RecordRow>(db, `SELECT ${RECORD_SELECT} FROM knowledge_records WHERE table_id = ? AND id = ?`, [tableId, recordId]);
    return row ? mapRecord(row) : null;
  });
}

export async function createKnowledgeRecord(tableId: string, actor: KnowledgeActor, input: Record<string, unknown>) {
  await ensureKnowledgeCollaborationSchema();
  const created = await writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const values = await validateRecordValues(db, tableId, input.values ?? {});
    const now = new Date().toISOString();
    const record: KnowledgeRecord = {
      createdAt: now,
      createdByAccount: actor.account,
      createdById: actor.id,
      id: randomUUID(),
      revision: 1,
      sortOrder: optionalInteger(input.sortOrder, "排序", { min: 0 }) ?? 0,
      tableId,
      updatedAt: now,
      updatedByAccount: actor.account,
      updatedById: actor.id,
      values
    };
    await db.execute(
      `INSERT INTO knowledge_records
       (id, table_id, values_json, sort_order, revision, created_by_id, created_by_account,
        updated_by_id, updated_by_account, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [record.id, tableId, JSON.stringify(values), record.sortOrder, actor.id, actor.account ?? null, actor.id, actor.account ?? null, now, now]
    );
    await recordKnowledgeActivity(db, {
      action: "created",
      actor,
      details: { fieldIds: Object.keys(values) },
      recordId: record.id,
      tableId
    });
    const runs = await queueKnowledgeAutomationRuns(db, {
      actor,
      event: "record_created",
      recordId: record.id,
      tableId
    });
    await db.execute("UPDATE knowledge_tables SET updated_at = ? WHERE id = ?", [now, tableId]);
    return { record, runs };
  });
  await executeKnowledgeAutomationRuns(created.runs, actor).catch((error) => {
    console.error("Failed to execute record-created knowledge automations", error);
  });
  return (await getKnowledgeRecord(tableId, created.record.id)) ?? created.record;
}

export async function updateKnowledgeRecord(tableId: string, recordId: string, actor: KnowledgeActor, input: Record<string, unknown>) {
  await ensureKnowledgeCollaborationSchema();
  const revision = requiredRevision(input.revision);
  const updated = await writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RecordRow>(db, `SELECT ${RECORD_SELECT} FROM knowledge_records WHERE table_id = ? AND id = ? FOR UPDATE`, [tableId, recordId]);
    if (!row) notFound("记录");
    const current = mapRecord(row as RecordRow);
    if (current.revision !== revision) conflict("记录");
    const values = await validateRecordValues(
      db,
      tableId,
      input.values === undefined ? current.values : input.values
    );
    const changedFieldIds = [...new Set([...Object.keys(current.values), ...Object.keys(values)])]
      .filter((fieldId) => JSON.stringify(current.values[fieldId]) !== JSON.stringify(values[fieldId]));
    const sortOrder = optionalInteger(input.sortOrder, "排序", { min: 0 }) ?? current.sortOrder;
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_records SET values_json = ?, sort_order = ?, revision = revision + 1,
       updated_by_id = ?, updated_by_account = ?, updated_at = ?
       WHERE id = ? AND table_id = ? AND revision = ?`,
      [JSON.stringify(values), sortOrder, actor.id, actor.account ?? null, now, recordId, tableId, revision]
    );
    if (!result.affectedRows) conflict("记录");
    await recordKnowledgeActivity(db, {
      action: "updated",
      actor,
      details: { changedFieldIds },
      recordId,
      tableId
    });
    const runs = await queueKnowledgeAutomationRuns(db, {
      actor,
      changedFieldIds,
      event: "record_updated",
      recordId,
      tableId
    });
    await db.execute("UPDATE knowledge_tables SET updated_at = ? WHERE id = ?", [now, tableId]);
    const record = { ...current, revision: revision + 1, sortOrder, updatedAt: now, updatedByAccount: actor.account, updatedById: actor.id, values };
    return { record, runs };
  });
  await executeKnowledgeAutomationRuns(updated.runs, actor).catch((error) => {
    console.error("Failed to execute record-updated knowledge automations", error);
  });
  return (await getKnowledgeRecord(tableId, recordId)) ?? updated.record;
}

export async function deleteKnowledgeRecord(
  tableId: string,
  recordId: string,
  revision: number,
  actor?: KnowledgeActor
) {
  await ensureKnowledgeCollaborationSchema();
  const deleted = await writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RecordRow>(db, `SELECT ${RECORD_SELECT} FROM knowledge_records WHERE table_id = ? AND id = ? FOR UPDATE`, [tableId, recordId]);
    if (!row) notFound("记录");
    if (Number((row as RecordRow).revision) !== revision) conflict("记录");
    await recordKnowledgeActivity(db, {
      action: "deleted",
      actor,
      details: { revision },
      recordId,
      tableId
    });
    await db.execute(
      "DELETE FROM knowledge_record_comments WHERE record_id = ? AND table_id = ?",
      [recordId, tableId]
    );
    const result = await db.execute("DELETE FROM knowledge_records WHERE id = ? AND table_id = ? AND revision = ?", [recordId, tableId, revision]);
    if (!result.affectedRows) conflict("记录");
    await db.execute(
      "UPDATE knowledge_tables SET updated_at = ? WHERE id = ?",
      [new Date().toISOString(), tableId]
    );
    return true;
  });
  await purgeKnowledgeRecordAttachments(tableId, recordId).catch((error) => {
    console.error("Failed to purge deleted knowledge record attachments", error);
  });
  return deleted;
}

function viewMetadata(value: unknown, label: string, array = false) {
  const fallback = array ? [] : {};
  if (array && value !== undefined && !Array.isArray(value)) {
    throw new KnowledgeValidationError("INVALID_INPUT", `${label}必须是 JSON 数组。`);
  }
  return jsonValue(value === undefined ? fallback : value, label, { maxBytes: 128 * 1024, objectOnly: !array });
}

function visibleFieldIds(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500 || !value.every((item) => typeof item === "string" && item.length <= 191)) {
    throw new KnowledgeValidationError("INVALID_INPUT", "visibleFieldIds 必须是最多 500 项的字段 ID 数组。");
  }
  return [...new Set(value as string[])];
}

function rowHeight(value: unknown, fallback: KnowledgeView["rowHeight"] = "medium") {
  return enumValue(value, "行高", ["compact", "medium", "tall"] as const, fallback);
}

async function assertVisibleFields(
  db: Database,
  tableId: string,
  fieldIds: string[]
) {
  if (!fieldIds.length) return;
  const fields = await getRows<{ id: string }>(
    db,
    "SELECT id FROM knowledge_fields WHERE table_id = ?",
    [tableId]
  );
  const validIds = new Set(fields.map((field) => field.id));
  if (fieldIds.some((fieldId) => !validIds.has(fieldId))) {
    throw new KnowledgeValidationError(
      "INVALID_FIELD",
      "视图包含不属于当前表格的字段。"
    );
  }
}

export async function listKnowledgeViews(tableId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) =>
    (await getRows<ViewRow>(db, `SELECT ${VIEW_SELECT} FROM knowledge_views WHERE table_id = ? ORDER BY is_default DESC, created_at`, [tableId])).map(mapView)
  );
}

export async function getKnowledgeView(tableId: string, viewId: string) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<ViewRow>(db, `SELECT ${VIEW_SELECT} FROM knowledge_views WHERE table_id = ? AND id = ?`, [tableId, viewId]);
    return row ? mapView(row) : null;
  });
}

export async function createKnowledgeView(tableId: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  const now = new Date().toISOString();
  const view: KnowledgeView = {
    createdAt: now,
    filter: viewMetadata(input.filter, "筛选条件") as Record<string, unknown>,
    frozenFieldCount: optionalInteger(input.frozenFieldCount, "冻结列数", { min: 0, max: 100 }) ?? 0,
    group: viewMetadata(input.group, "分组条件") as Record<string, unknown>,
    id: randomUUID(),
    isDefault: optionalBoolean(input.isDefault, "默认视图") ?? false,
    name: requiredString(input.name, "视图名称", 255),
    revision: 1,
    rowHeight: rowHeight(input.rowHeight),
    sort: viewMetadata(input.sort, "排序条件", true) as unknown[],
    tableId,
    updatedAt: now,
    viewType: enumValue(input.viewType, "视图类型", knowledgeViewTypes, "grid"),
    visibleFieldIds: visibleFieldIds(input.visibleFieldIds)
  };
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    await assertVisibleFields(db, tableId, view.visibleFieldIds);
    if (view.isDefault) await db.execute("UPDATE knowledge_views SET is_default = 0 WHERE table_id = ?", [tableId]);
    await db.execute(
      `INSERT INTO knowledge_views
       (id, table_id, name, view_type, filter_json, sort_json, group_json, visible_field_ids_json,
        row_height, frozen_field_count, is_default, revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [view.id, tableId, view.name, view.viewType, JSON.stringify(view.filter), JSON.stringify(view.sort), JSON.stringify(view.group), JSON.stringify(view.visibleFieldIds), view.rowHeight, view.frozenFieldCount, view.isDefault, now, now]
    );
    return view;
  });
}

export async function updateKnowledgeView(tableId: string, viewId: string, input: Record<string, unknown>) {
  await ensureKnowledgeSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<ViewRow>(db, `SELECT ${VIEW_SELECT} FROM knowledge_views WHERE table_id = ? AND id = ? FOR UPDATE`, [tableId, viewId]);
    if (!row) notFound("视图");
    const current = mapView(row as ViewRow);
    if (current.revision !== revision) conflict("视图");
    const name = optionalString(input.name, "视图名称", 255) ?? current.name;
    if (!name) throw new KnowledgeValidationError("INVALID_INPUT", "视图名称不能为空。");
    const next = {
      filter: input.filter === undefined ? current.filter : viewMetadata(input.filter, "筛选条件") as Record<string, unknown>,
      frozenFieldCount: optionalInteger(input.frozenFieldCount, "冻结列数", { min: 0, max: 100 }) ?? current.frozenFieldCount,
      group: input.group === undefined ? current.group : viewMetadata(input.group, "分组条件") as Record<string, unknown>,
      isDefault: optionalBoolean(input.isDefault, "默认视图") ?? current.isDefault,
      name,
      rowHeight: input.rowHeight === undefined ? current.rowHeight : rowHeight(input.rowHeight),
      sort: input.sort === undefined ? current.sort : viewMetadata(input.sort, "排序条件", true) as unknown[],
      viewType: input.viewType === undefined ? current.viewType : enumValue(input.viewType, "视图类型", knowledgeViewTypes),
      visibleFieldIds: input.visibleFieldIds === undefined ? current.visibleFieldIds : visibleFieldIds(input.visibleFieldIds)
    };
    await assertVisibleFields(db, tableId, next.visibleFieldIds);
    if (next.isDefault) await db.execute("UPDATE knowledge_views SET is_default = 0 WHERE table_id = ? AND id <> ?", [tableId, viewId]);
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_views SET name = ?, view_type = ?, filter_json = ?, sort_json = ?, group_json = ?,
       visible_field_ids_json = ?, row_height = ?, frozen_field_count = ?, is_default = ?,
       revision = revision + 1, updated_at = ? WHERE id = ? AND table_id = ? AND revision = ?`,
      [next.name, next.viewType, JSON.stringify(next.filter), JSON.stringify(next.sort), JSON.stringify(next.group), JSON.stringify(next.visibleFieldIds), next.rowHeight, next.frozenFieldCount, next.isDefault, now, viewId, tableId, revision]
    );
    if (!result.affectedRows) conflict("视图");
    return { ...current, ...next, revision: revision + 1, updatedAt: now };
  });
}

export async function deleteKnowledgeView(tableId: string, viewId: string, revision: number) {
  await ensureKnowledgeSchema();
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<ViewRow>(db, `SELECT ${VIEW_SELECT} FROM knowledge_views WHERE table_id = ? AND id = ? FOR UPDATE`, [tableId, viewId]);
    if (!row) notFound("视图");
    if (Number((row as ViewRow).revision) !== revision) conflict("视图");
    const result = await db.execute("DELETE FROM knowledge_views WHERE table_id = ? AND id = ? AND revision = ?", [tableId, viewId, revision]);
    if (!result.affectedRows) conflict("视图");
    return true;
  });
}

export async function getKnowledgeDashboard(
  ownerId?: string,
  accessibleSpaceIds?: string[]
) {
  await ensureKnowledgeSchema();
  return readDatabase(async (db) => {
    const uniqueSpaceIds = accessibleSpaceIds
      ? [...new Set(accessibleSpaceIds)].slice(0, 1000)
      : undefined;
    const accessJoin = uniqueSpaceIds
      ? uniqueSpaceIds.length
        ? ` AND s.id IN (${uniqueSpaceIds.map(() => "?").join(", ")})`
        : " AND 1 = 0"
      : ownerId
        ? " AND s.owner_id = ?"
        : "";
    const params = uniqueSpaceIds ?? (ownerId ? [ownerId] : []);
    const [spaceCount, pageCount, tableCount, recordCount, recentPageRows, recentTableRows] = await Promise.all([
      getFirstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM knowledge_spaces s WHERE 1 = 1${accessJoin}`, params),
      getFirstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM knowledge_pages p INNER JOIN knowledge_spaces s ON s.id = p.space_id WHERE p.deleted_at IS NULL${accessJoin}`, params),
      getFirstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM knowledge_tables t INNER JOIN knowledge_spaces s ON s.id = t.space_id WHERE t.deleted_at IS NULL${accessJoin}`, params),
      getFirstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM knowledge_records r INNER JOIN knowledge_tables t ON t.id = r.table_id INNER JOIN knowledge_spaces s ON s.id = t.space_id WHERE t.deleted_at IS NULL${accessJoin}`, params),
      getRows<PageRow>(db, `SELECT p.id, p.space_id, p.parent_id, p.title, p.slug,
        p.page_type, p.icon, p.content_json, p.sort_order, p.revision,
        p.created_at, p.updated_at
        FROM knowledge_pages p INNER JOIN knowledge_spaces s ON s.id = p.space_id
        WHERE p.deleted_at IS NULL${accessJoin} ORDER BY p.updated_at DESC LIMIT 8`, params),
      getRows<TableRow>(db, `SELECT t.id, t.space_id, t.title, t.description, t.icon, t.revision, t.created_at, t.updated_at FROM knowledge_tables t INNER JOIN knowledge_spaces s ON s.id = t.space_id WHERE t.deleted_at IS NULL${accessJoin} ORDER BY t.updated_at DESC LIMIT 8`, params)
    ]);

    return {
      pageCount: Number(pageCount?.total ?? 0),
      recentPages: recentPageRows.map((row) => {
        const page = mapPage(row);
        return {
          createdAt: page.createdAt,
          icon: page.icon,
          id: page.id,
          pageType: page.pageType,
          parentId: page.parentId,
          revision: page.revision,
          slug: page.slug,
          sortOrder: page.sortOrder,
          spaceId: page.spaceId,
          title: page.title,
          updatedAt: page.updatedAt
        };
      }),
      recentTables: recentTableRows.map(mapTable),
      recordCount: Number(recordCount?.total ?? 0),
      spaceCount: Number(spaceCount?.total ?? 0),
      tableCount: Number(tableCount?.total ?? 0)
    };
  });
}
