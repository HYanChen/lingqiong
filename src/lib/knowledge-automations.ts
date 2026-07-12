import { randomUUID } from "node:crypto";

import {
  getFirstRow,
  getRows,
  readDatabase,
  type Database,
  writeDatabase
} from "@/lib/database";
import { recordKnowledgeActivity } from "@/lib/knowledge-collaboration";
import { ensureKnowledgeCollaborationSchema } from "@/lib/knowledge-collaboration-schema";
import type { KnowledgeActor } from "@/lib/knowledge-workspace";
import {
  enumValue,
  isPlainObject,
  jsonValue,
  KnowledgeValidationError,
  optionalBoolean,
  optionalString,
  requiredRevision,
  requiredString
} from "@/lib/knowledge-validation";

export const knowledgeAutomationTriggerTypes = [
  "record_created",
  "record_updated",
  "field_changed",
  "schedule",
  "manual"
] as const;
export type KnowledgeAutomationTriggerType =
  (typeof knowledgeAutomationTriggerTypes)[number];

export const knowledgeAutomationRunStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped"
] as const;
export type KnowledgeAutomationRunStatus =
  (typeof knowledgeAutomationRunStatuses)[number];

export type KnowledgeAutomationRule = {
  actions: Record<string, unknown>[];
  conditions: Record<string, unknown>;
  createdAt: string;
  createdByAccount?: string;
  createdById?: string;
  enabled: boolean;
  id: string;
  name: string;
  revision: number;
  tableId: string;
  triggerConfig: Record<string, unknown>;
  triggerType: KnowledgeAutomationTriggerType;
  updatedAt: string;
};

export type KnowledgeAutomationRun = {
  createdAt: string;
  error?: string;
  finishedAt?: string;
  id: string;
  recordId?: string;
  result?: Record<string, unknown>;
  revision: number;
  ruleId: string;
  startedAt?: string;
  status: KnowledgeAutomationRunStatus;
  tableId: string;
  triggerPayload: Record<string, unknown>;
  updatedAt: string;
};

type RuleRow = {
  actions_json: string;
  conditions_json: string;
  created_at: string;
  created_by_account: string | null;
  created_by_id: string | null;
  enabled: number;
  id: string;
  name: string;
  revision: number;
  table_id: string;
  trigger_config_json: string;
  trigger_type: string;
  updated_at: string;
};

type RunRow = {
  created_at: string;
  error_text: string | null;
  finished_at: string | null;
  id: string;
  record_id: string | null;
  result_json: string | null;
  revision: number;
  rule_id: string;
  started_at: string | null;
  status: string;
  table_id: string;
  trigger_payload_json: string;
  updated_at: string;
};

const RULE_SELECT = `id, table_id, name, trigger_type, trigger_config_json,
  conditions_json, actions_json, enabled, revision, created_by_id,
  created_by_account, created_at, updated_at`;
const RUN_SELECT = `id, rule_id, table_id, record_id, status,
  trigger_payload_json, result_json, error_text, revision, started_at,
  finished_at, created_at, updated_at`;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapRule(row: RuleRow): KnowledgeAutomationRule {
  return {
    actions: parseJson<Record<string, unknown>[]>(row.actions_json, []),
    conditions: parseJson<Record<string, unknown>>(row.conditions_json, {}),
    createdAt: row.created_at,
    createdByAccount: row.created_by_account ?? undefined,
    createdById: row.created_by_id ?? undefined,
    enabled: Boolean(row.enabled),
    id: row.id,
    name: row.name,
    revision: Number(row.revision),
    tableId: row.table_id,
    triggerConfig: parseJson<Record<string, unknown>>(row.trigger_config_json, {}),
    triggerType: row.trigger_type as KnowledgeAutomationTriggerType,
    updatedAt: row.updated_at
  };
}

function mapRun(row: RunRow): KnowledgeAutomationRun {
  return {
    createdAt: row.created_at,
    error: row.error_text ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    id: row.id,
    recordId: row.record_id ?? undefined,
    result: row.result_json
      ? parseJson<Record<string, unknown>>(row.result_json, {})
      : undefined,
    revision: Number(row.revision),
    ruleId: row.rule_id,
    startedAt: row.started_at ?? undefined,
    status: row.status as KnowledgeAutomationRunStatus,
    tableId: row.table_id,
    triggerPayload: parseJson<Record<string, unknown>>(row.trigger_payload_json, {}),
    updatedAt: row.updated_at
  };
}

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

async function lockTable(db: Database, tableId: string) {
  const table = await getFirstRow<{ id: string; space_id: string }>(
    db,
    `SELECT id, space_id FROM knowledge_tables
     WHERE id = ? AND deleted_at IS NULL`,
    [tableId]
  );
  if (!table) notFound("多维表格");
  const space = await getFirstRow<{ id: string }>(
    db,
    "SELECT id FROM knowledge_spaces WHERE id = ? FOR UPDATE",
    [table.space_id]
  );
  if (!space) notFound("知识空间");
  const locked = await getFirstRow<{ id: string }>(
    db,
    `SELECT id FROM knowledge_tables
     WHERE id = ? AND space_id = ? AND deleted_at IS NULL FOR UPDATE`,
    [tableId, table.space_id]
  );
  if (!locked) notFound("多维表格");
}

function metadataObject(value: unknown, label: string, maxBytes = 128 * 1024) {
  return jsonValue(value ?? {}, label, {
    maxBytes,
    objectOnly: true
  }) as Record<string, unknown>;
}

function automationActions(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new KnowledgeValidationError(
      "INVALID_INPUT",
      "自动化动作必须包含 1 到 20 项。"
    );
  }
  const actions = value.map((action) => {
    if (!isPlainObject(action)) {
      throw new KnowledgeValidationError("INVALID_INPUT", "自动化动作必须是 JSON 对象。");
    }
    const type = requiredString(action.type, "自动化动作类型", 40);
    if (!["notification", "set_field", "update_record"].includes(type)) {
      throw new KnowledgeValidationError(
        "INVALID_AUTOMATION_ACTION",
        `不支持的自动化动作：${type}。`
      );
    }
    if (type === "set_field") {
      requiredString(action.fieldId, "字段 ID", 191);
      if (!("value" in action)) {
        throw new KnowledgeValidationError(
          "INVALID_AUTOMATION_ACTION",
          "set_field 动作必须提供 value。"
        );
      }
      jsonValue(action.value, "字段值", { maxBytes: 128 * 1024 });
    }
    if (type === "update_record") {
      jsonValue(action.values, "记录更新值", {
        maxBytes: 256 * 1024,
        objectOnly: true
      });
    }
    if (type === "notification") {
      requiredString(action.message, "通知内容", 2000);
    }
    return action;
  });
  jsonValue(actions, "自动化动作", { maxBytes: 256 * 1024 });
  return actions;
}

function automationConditions(value: unknown) {
  const conditions = metadataObject(value, "自动化条件");
  if (!Object.keys(conditions).length) return conditions;
  const conjunction = conditions.conjunction ?? "and";
  if (conjunction !== "and" && conjunction !== "or") {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_CONDITION",
      "条件 conjunction 只能是 and 或 or。"
    );
  }
  if (!Array.isArray(conditions.conditions) || conditions.conditions.length > 20) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_CONDITION",
      "conditions 必须是最多 20 项的数组。"
    );
  }
  for (const condition of conditions.conditions) {
    if (!isPlainObject(condition)) {
      throw new KnowledgeValidationError(
        "INVALID_AUTOMATION_CONDITION",
        "每个条件都必须是 JSON 对象。"
      );
    }
    requiredString(condition.fieldId, "条件字段 ID", 191);
    const operator = requiredString(condition.operator, "条件运算符", 32);
    if (operator !== "equals" && operator !== "contains") {
      throw new KnowledgeValidationError(
        "INVALID_AUTOMATION_CONDITION",
        `不支持的条件运算符：${operator}。`
      );
    }
    if (!("value" in condition)) {
      throw new KnowledgeValidationError(
        "INVALID_AUTOMATION_CONDITION",
        "条件必须提供 value。"
      );
    }
    jsonValue(condition.value, "条件值", { maxBytes: 64 * 1024 });
  }
  return conditions;
}

async function assertAutomationReferences(
  db: Database,
  tableId: string,
  conditions: Record<string, unknown>,
  actions: Record<string, unknown>[]
) {
  const fields = await getRows<{ id: string }>(
    db,
    "SELECT id FROM knowledge_fields WHERE table_id = ?",
    [tableId]
  );
  const validIds = new Set(fields.map((field) => field.id));
  const referencedIds: string[] = [];
  if (Array.isArray(conditions.conditions)) {
    for (const condition of conditions.conditions) {
      if (isPlainObject(condition) && typeof condition.fieldId === "string") {
        referencedIds.push(condition.fieldId);
      }
    }
  }
  for (const action of actions) {
    if (action.type === "set_field" && typeof action.fieldId === "string") {
      referencedIds.push(action.fieldId);
    }
    if (action.type === "update_record" && isPlainObject(action.values)) {
      referencedIds.push(...Object.keys(action.values));
    }
  }
  const invalid = [...new Set(referencedIds)].filter((fieldId) => !validIds.has(fieldId));
  if (invalid.length) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_REFERENCE",
      "自动化引用了不属于当前表格的字段。",
      400,
      { fieldIds: invalid }
    );
  }
}

async function createRunWithDatabase(
  db: Database,
  input: {
    recordId?: string;
    ruleId: string;
    tableId: string;
    triggerPayload?: Record<string, unknown>;
  }
) {
  const now = new Date().toISOString();
  const triggerPayload = metadataObject(input.triggerPayload, "触发数据", 64 * 1024);
  const run: KnowledgeAutomationRun = {
    createdAt: now,
    id: randomUUID(),
    recordId: input.recordId,
    revision: 1,
    ruleId: input.ruleId,
    status: "queued",
    tableId: input.tableId,
    triggerPayload,
    updatedAt: now
  };
  await db.execute(
    `INSERT INTO knowledge_automation_runs
     (id, rule_id, table_id, record_id, status, trigger_payload_json,
      result_json, error_text, revision, started_at, finished_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'queued', ?, NULL, NULL, 1, NULL, NULL, ?, ?)`,
    [run.id, input.ruleId, input.tableId, input.recordId ?? null, JSON.stringify(triggerPayload), now, now]
  );
  return run;
}

export async function listKnowledgeAutomationRules(tableId: string) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) =>
    (
      await getRows<RuleRow>(
        db,
        `SELECT ${RULE_SELECT} FROM knowledge_automation_rules
         WHERE table_id = ? ORDER BY updated_at DESC`,
        [tableId]
      )
    ).map(mapRule)
  );
}

export async function getKnowledgeAutomationRule(tableId: string, ruleId: string) {
  await ensureKnowledgeCollaborationSchema();
  return readDatabase(async (db) => {
    const row = await getFirstRow<RuleRow>(
      db,
      `SELECT ${RULE_SELECT} FROM knowledge_automation_rules
       WHERE id = ? AND table_id = ?`,
      [ruleId, tableId]
    );
    return row ? mapRule(row) : null;
  });
}

export async function createKnowledgeAutomationRule(
  tableId: string,
  actor: KnowledgeActor,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const now = new Date().toISOString();
  const rule: KnowledgeAutomationRule = {
    actions: automationActions(input.actions),
    conditions: automationConditions(input.conditions),
    createdAt: now,
    createdByAccount: actor.account,
    createdById: actor.id,
    enabled: optionalBoolean(input.enabled, "是否启用") ?? true,
    id: randomUUID(),
    name: requiredString(input.name, "自动化名称", 255),
    revision: 1,
    tableId,
    triggerConfig: metadataObject(input.triggerConfig, "触发配置"),
    triggerType: enumValue(
      input.triggerType,
      "触发类型",
      knowledgeAutomationTriggerTypes
    ),
    updatedAt: now
  };
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    await assertAutomationReferences(db, tableId, rule.conditions, rule.actions);
    await db.execute(
      `INSERT INTO knowledge_automation_rules
       (id, table_id, name, trigger_type, trigger_config_json, conditions_json,
        actions_json, enabled, revision, created_by_id, created_by_account,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        rule.id,
        tableId,
        rule.name,
        rule.triggerType,
        JSON.stringify(rule.triggerConfig),
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.enabled,
        actor.id,
        actor.account ?? null,
        now,
        now
      ]
    );
    return rule;
  });
}

export async function updateKnowledgeAutomationRule(
  tableId: string,
  ruleId: string,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const revision = requiredRevision(input.revision);
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RuleRow>(
      db,
      `SELECT ${RULE_SELECT} FROM knowledge_automation_rules
       WHERE id = ? AND table_id = ? FOR UPDATE`,
      [ruleId, tableId]
    );
    if (!row) notFound("自动化规则");
    const current = mapRule(row);
    if (current.revision !== revision) conflict("自动化规则");
    const name = optionalString(input.name, "自动化名称", 255) ?? current.name;
    if (!name) throw new KnowledgeValidationError("INVALID_INPUT", "自动化名称不能为空。");
    const next = {
      actions: input.actions === undefined ? current.actions : automationActions(input.actions),
      conditions:
        input.conditions === undefined
          ? current.conditions
          : automationConditions(input.conditions),
      enabled: optionalBoolean(input.enabled, "是否启用") ?? current.enabled,
      name,
      triggerConfig:
        input.triggerConfig === undefined
          ? current.triggerConfig
          : metadataObject(input.triggerConfig, "触发配置"),
      triggerType:
        input.triggerType === undefined
          ? current.triggerType
          : enumValue(input.triggerType, "触发类型", knowledgeAutomationTriggerTypes)
    };
    const now = new Date().toISOString();
    await assertAutomationReferences(db, tableId, next.conditions, next.actions);
    const result = await db.execute(
      `UPDATE knowledge_automation_rules SET name = ?, trigger_type = ?,
       trigger_config_json = ?, conditions_json = ?, actions_json = ?, enabled = ?,
       revision = revision + 1, updated_at = ?
       WHERE id = ? AND table_id = ? AND revision = ?`,
      [
        next.name,
        next.triggerType,
        JSON.stringify(next.triggerConfig),
        JSON.stringify(next.conditions),
        JSON.stringify(next.actions),
        next.enabled,
        now,
        ruleId,
        tableId,
        revision
      ]
    );
    if (!result.affectedRows) conflict("自动化规则");
    return { ...current, ...next, revision: revision + 1, updatedAt: now };
  });
}

export async function deleteKnowledgeAutomationRule(
  tableId: string,
  ruleId: string,
  revision: number
) {
  await ensureKnowledgeCollaborationSchema();
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RuleRow>(
      db,
      `SELECT ${RULE_SELECT} FROM knowledge_automation_rules
       WHERE id = ? AND table_id = ? FOR UPDATE`,
      [ruleId, tableId]
    );
    if (!row) notFound("自动化规则");
    if (Number(row.revision) !== revision) conflict("自动化规则");
    const result = await db.execute(
      `DELETE FROM knowledge_automation_rules
       WHERE id = ? AND table_id = ? AND revision = ?`,
      [ruleId, tableId, revision]
    );
    if (!result.affectedRows) conflict("自动化规则");
    return true;
  });
}

export async function listKnowledgeAutomationRuns(
  tableId: string,
  ruleId?: string,
  limit = 200
) {
  await ensureKnowledgeCollaborationSchema();
  const bounded = Math.max(1, Math.min(500, Math.floor(limit)));
  return readDatabase(async (db) =>
    (
      await getRows<RunRow>(
        db,
        `SELECT ${RUN_SELECT} FROM knowledge_automation_runs
         WHERE table_id = ?${ruleId ? " AND rule_id = ?" : ""}
         ORDER BY created_at DESC LIMIT ${bounded}`,
        ruleId ? [tableId, ruleId] : [tableId]
      )
    ).map(mapRun)
  );
}

export async function createManualKnowledgeAutomationRun(
  tableId: string,
  ruleId: string,
  input: Record<string, unknown>,
  actor?: KnowledgeActor
) {
  await ensureKnowledgeCollaborationSchema();
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const rule = await getFirstRow<{ enabled: number; id: string }>(
      db,
      `SELECT id, enabled FROM knowledge_automation_rules
       WHERE id = ? AND table_id = ? FOR UPDATE`,
      [ruleId, tableId]
    );
    if (!rule) notFound("自动化规则");
    if (!rule.enabled) {
      throw new KnowledgeValidationError("AUTOMATION_DISABLED", "自动化规则未启用。", 409);
    }
    const recordId = input.recordId === undefined
      ? undefined
      : requiredString(input.recordId, "记录 ID", 191);
    if (recordId) {
      const record = await getFirstRow<{ id: string }>(
        db,
        "SELECT id FROM knowledge_records WHERE id = ? AND table_id = ?",
        [recordId, tableId]
      );
      if (!record) notFound("记录");
    }
    const triggerPayload = metadataObject(input.triggerPayload, "触发数据", 64 * 1024);
    if (actor?.id) triggerPayload.actorId = actor.id;
    if (actor?.account) triggerPayload.actorAccount = actor.account;
    return createRunWithDatabase(db, {
      recordId,
      ruleId,
      tableId,
      triggerPayload
    });
  });
}

const runTransitions: Record<KnowledgeAutomationRunStatus, KnowledgeAutomationRunStatus[]> = {
  failed: [],
  queued: ["failed", "running", "skipped"],
  running: ["failed", "skipped", "succeeded"],
  skipped: [],
  succeeded: []
};

export async function updateKnowledgeAutomationRun(
  tableId: string,
  ruleId: string,
  runId: string,
  input: Record<string, unknown>
) {
  await ensureKnowledgeCollaborationSchema();
  const revision = requiredRevision(input.revision);
  const status = enumValue(input.status, "运行状态", knowledgeAutomationRunStatuses);
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RunRow>(
      db,
      `SELECT ${RUN_SELECT} FROM knowledge_automation_runs
       WHERE id = ? AND rule_id = ? AND table_id = ? FOR UPDATE`,
      [runId, ruleId, tableId]
    );
    if (!row) notFound("自动化运行记录");
    const current = mapRun(row);
    if (current.revision !== revision) conflict("自动化运行记录");
    if (!runTransitions[current.status].includes(status)) {
      throw new KnowledgeValidationError(
        "INVALID_STATUS_TRANSITION",
        `不能从 ${current.status} 变更为 ${status}。`,
        409
      );
    }
    const resultValue = input.result === undefined
      ? current.result
      : metadataObject(input.result, "运行结果", 256 * 1024);
    const error = optionalString(input.error, "错误信息", 10_000);
    const now = new Date().toISOString();
    const startedAt = current.startedAt ?? (status === "running" ? now : undefined);
    const finishedAt = ["failed", "skipped", "succeeded"].includes(status)
      ? now
      : undefined;
    const result = await db.execute(
      `UPDATE knowledge_automation_runs SET status = ?, result_json = ?, error_text = ?,
       revision = revision + 1, started_at = ?, finished_at = ?, updated_at = ?
       WHERE id = ? AND rule_id = ? AND table_id = ? AND revision = ?`,
      [
        status,
        resultValue === undefined ? null : JSON.stringify(resultValue),
        error ?? current.error ?? null,
        startedAt ?? null,
        finishedAt ?? null,
        now,
        runId,
        ruleId,
        tableId,
        revision
      ]
    );
    if (!result.affectedRows) conflict("自动化运行记录");
    return {
      ...current,
      error: error ?? current.error,
      finishedAt,
      result: resultValue,
      revision: revision + 1,
      startedAt,
      status,
      updatedAt: now
    };
  });
}

type AutomationRecordRow = {
  revision: number;
  values_json: string;
};

function automationScalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(automationScalar).join("、");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function conditionMatches(
  values: Record<string, unknown>,
  condition: Record<string, unknown>
) {
  const fieldId = requiredString(condition.fieldId, "条件字段 ID", 191);
  const operator = requiredString(condition.operator, "条件运算符", 32);
  const actual = values[fieldId];
  if (operator === "equals") {
    return JSON.stringify(actual ?? null) === JSON.stringify(condition.value ?? null);
  }
  if (operator === "contains") {
    return automationScalar(actual)
      .toLocaleLowerCase("zh-CN")
      .includes(automationScalar(condition.value).toLocaleLowerCase("zh-CN"));
  }
  throw new KnowledgeValidationError(
    "INVALID_AUTOMATION_CONDITION",
    `不支持的条件运算符：${operator}。`
  );
}

function conditionsMatch(
  conditions: Record<string, unknown>,
  values: Record<string, unknown>
) {
  if (!Object.keys(conditions).length) return true;
  const items = Array.isArray(conditions.conditions)
    ? conditions.conditions.filter(isPlainObject)
    : [];
  if (!items.length) return true;
  const matches = items.map((condition) => conditionMatches(values, condition));
  return conditions.conjunction === "or" ? matches.some(Boolean) : matches.every(Boolean);
}

function validateAutomationFieldValue(fieldType: string, value: unknown, fieldId: string) {
  if (value === null || value === "") return;
  if (["autonumber", "created_time", "updated_time"].includes(fieldType)) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 是只读字段。`
    );
  }
  if (
    ["currency", "number", "progress", "rating"].includes(fieldType) &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须是数值。`
    );
  }
  if (fieldType === "checkbox" && typeof value !== "boolean") {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须是布尔值。`
    );
  }
  if (["attachment", "multi_select"].includes(fieldType) && !Array.isArray(value)) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须是数组。`
    );
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
    typeof value !== "string"
  ) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须是文本。`
    );
  }
  if (fieldType === "progress" && typeof value === "number" && (value < 0 || value > 100)) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须在 0 到 100 之间。`
    );
  }
  if (fieldType === "rating" && typeof value === "number" && (value < 0 || value > 5)) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须在 0 到 5 之间。`
    );
  }
  if (fieldType === "url" && typeof value === "string" && !/^https?:\/\//iu.test(value)) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须是 HTTP(S) 地址。`
    );
  }
  if (
    fieldType === "email" &&
    typeof value === "string" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
  ) {
    throw new KnowledgeValidationError(
      "INVALID_AUTOMATION_ACTION",
      `字段 ${fieldId} 必须是邮箱地址。`
    );
  }
}

async function finishAutomationRun(
  db: Database,
  run: KnowledgeAutomationRun,
  status: "failed" | "skipped" | "succeeded",
  resultValue: Record<string, unknown>,
  error?: string
) {
  const now = new Date().toISOString();
  const result = await db.execute(
    `UPDATE knowledge_automation_runs SET status = ?, result_json = ?, error_text = ?,
     revision = revision + 1, finished_at = ?, updated_at = ?
     WHERE id = ? AND rule_id = ? AND table_id = ? AND status = 'running' AND revision = ?`,
    [
      status,
      JSON.stringify(resultValue),
      error ?? null,
      now,
      now,
      run.id,
      run.ruleId,
      run.tableId,
      run.revision
    ]
  );
  if (!result.affectedRows) conflict("自动化运行记录");
  return {
    ...run,
    error,
    finishedAt: now,
    result: resultValue,
    revision: run.revision + 1,
    status,
    updatedAt: now
  } satisfies KnowledgeAutomationRun;
}

async function markAutomationRunFailed(
  tableId: string,
  ruleId: string,
  runId: string,
  error: unknown
) {
  const message = (error instanceof Error ? error.message : "自动化执行失败。")
    .slice(0, 10_000);
  return writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RunRow>(
      db,
      `SELECT ${RUN_SELECT} FROM knowledge_automation_runs
       WHERE id = ? AND rule_id = ? AND table_id = ? FOR UPDATE`,
      [runId, ruleId, tableId]
    );
    if (!row) notFound("自动化运行记录");
    const run = mapRun(row);
    if (run.status !== "running") return run;
    return finishAutomationRun(
      db,
      run,
      "failed",
      { errorCode: (error as { code?: string }).code ?? "AUTOMATION_EXECUTION_FAILED" },
      message
    );
  });
}

export async function executeKnowledgeAutomationRun(
  tableId: string,
  ruleId: string,
  runId: string,
  actor?: KnowledgeActor
) {
  await ensureKnowledgeCollaborationSchema();
  const started = await writeDatabase(async (db) => {
    await lockTable(db, tableId);
    const row = await getFirstRow<RunRow>(
      db,
      `SELECT ${RUN_SELECT} FROM knowledge_automation_runs
       WHERE id = ? AND rule_id = ? AND table_id = ? FOR UPDATE`,
      [runId, ruleId, tableId]
    );
    if (!row) notFound("自动化运行记录");
    const current = mapRun(row);
    if (["failed", "skipped", "succeeded"].includes(current.status)) {
      return current;
    }
    if (current.status === "running") {
      throw new KnowledgeValidationError(
        "AUTOMATION_ALREADY_RUNNING",
        "自动化任务正在执行。",
        409
      );
    }
    const now = new Date().toISOString();
    const result = await db.execute(
      `UPDATE knowledge_automation_runs SET status = 'running', revision = revision + 1,
       started_at = ?, updated_at = ?
       WHERE id = ? AND rule_id = ? AND table_id = ? AND status = 'queued' AND revision = ?`,
      [now, now, runId, ruleId, tableId, current.revision]
    );
    if (!result.affectedRows) conflict("自动化运行记录");
    return {
      ...current,
      revision: current.revision + 1,
      startedAt: now,
      status: "running" as const,
      updatedAt: now
    };
  });

  if (started.status !== "running") return started;

  try {
    return await writeDatabase(async (db) => {
      await lockTable(db, tableId);
      const ruleRow = await getFirstRow<RuleRow>(
        db,
        `SELECT ${RULE_SELECT} FROM knowledge_automation_rules
         WHERE id = ? AND table_id = ? FOR UPDATE`,
        [ruleId, tableId]
      );
      const runRow = await getFirstRow<RunRow>(
        db,
        `SELECT ${RUN_SELECT} FROM knowledge_automation_runs
         WHERE id = ? AND rule_id = ? AND table_id = ? FOR UPDATE`,
        [runId, ruleId, tableId]
      );
      if (!runRow) notFound("自动化运行记录");
      const run = mapRun(runRow);
      if (run.status !== "running") conflict("自动化运行记录");
      if (!ruleRow) {
        return finishAutomationRun(
          db,
          run,
          "skipped",
          { matched: false, reason: "rule_deleted" }
        );
      }
      const rule = mapRule(ruleRow);
      if (!rule.enabled) {
        return finishAutomationRun(
          db,
          run,
          "skipped",
          { matched: false, reason: "rule_disabled" }
        );
      }

      let record: AutomationRecordRow | null = null;
      let values: Record<string, unknown> = {};
      if (run.recordId) {
        record = await getFirstRow<AutomationRecordRow>(
          db,
          `SELECT values_json, revision FROM knowledge_records
           WHERE id = ? AND table_id = ? FOR UPDATE`,
          [run.recordId, tableId]
        );
        if (!record) notFound("自动化关联记录");
        values = parseJson<Record<string, unknown>>(record.values_json, {});
      }
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
      const fieldTypes = new Map(fields.map((field) => [field.id, field.field_type]));
      const conditionItems = Array.isArray(rule.conditions.conditions)
        ? rule.conditions.conditions.filter(isPlainObject)
        : [];
      for (const condition of conditionItems) {
        const fieldId = requiredString(condition.fieldId, "条件字段 ID", 191);
        if (!fieldTypes.has(fieldId)) {
          throw new KnowledgeValidationError(
            "INVALID_AUTOMATION_CONDITION",
            `条件字段 ${fieldId} 不属于当前表格。`
          );
        }
      }
      if (!conditionsMatch(rule.conditions, values)) {
        return finishAutomationRun(
          db,
          run,
          "skipped",
          { matched: false, reason: "conditions_not_met" }
        );
      }

      const nextValues = { ...values };
      const changedFieldIds = new Set<string>();
      const notifications: Array<{ message: string; type: "in_app_log" }> = [];

      for (const action of rule.actions) {
        const type = requiredString(action.type, "自动化动作类型", 40);
        if (type === "notification") {
          notifications.push({
            message: requiredString(action.message, "通知内容", 2000),
            type: "in_app_log"
          });
          continue;
        }
        if (!run.recordId || !record) {
          throw new KnowledgeValidationError(
            "AUTOMATION_RECORD_REQUIRED",
            `${type} 动作需要关联记录。`
          );
        }
        const updates =
          type === "set_field"
            ? {
                [requiredString(action.fieldId, "字段 ID", 191)]: action.value
              }
            : type === "update_record" && isPlainObject(action.values)
              ? action.values
              : null;
        if (!updates) {
          throw new KnowledgeValidationError(
            "INVALID_AUTOMATION_ACTION",
            `不支持的自动化动作：${type}。`
          );
        }
        for (const [fieldId, value] of Object.entries(updates)) {
          const fieldType = fieldTypes.get(fieldId);
          if (!fieldType) {
            throw new KnowledgeValidationError(
              "INVALID_AUTOMATION_ACTION",
              `字段 ${fieldId} 不属于当前表格。`
            );
          }
          validateAutomationFieldValue(fieldType, value, fieldId);
          if (JSON.stringify(nextValues[fieldId]) !== JSON.stringify(value)) {
            nextValues[fieldId] = value;
            changedFieldIds.add(fieldId);
          }
        }
      }

      jsonValue(nextValues, "自动化记录结果", {
        maxBytes: 512 * 1024,
        objectOnly: true
      });
      for (const field of fields) {
        const config = parseJson<Record<string, unknown>>(field.config_json, {});
        const value = nextValues[field.id];
        if (
          config.required === true &&
          (value === undefined ||
            value === null ||
            value === "" ||
            (Array.isArray(value) && value.length === 0))
        ) {
          throw new KnowledgeValidationError(
            "REQUIRED_FIELD_MISSING",
            `必填字段“${field.name}”不能为空。`
          );
        }
      }
      let recordRevision = record?.revision;
      if (record && run.recordId && changedFieldIds.size) {
        const now = new Date().toISOString();
        const result = await db.execute(
          `UPDATE knowledge_records SET values_json = ?, revision = revision + 1,
           updated_by_id = ?, updated_by_account = ?, updated_at = ?
           WHERE id = ? AND table_id = ? AND revision = ?`,
          [
            JSON.stringify(nextValues),
            actor?.id ?? `automation:${rule.id}`,
            actor?.account ?? rule.name,
            now,
            run.recordId,
            tableId,
            record.revision
          ]
        );
        if (!result.affectedRows) conflict("自动化关联记录");
        recordRevision = Number(record.revision) + 1;
        await db.execute("UPDATE knowledge_tables SET updated_at = ? WHERE id = ?", [now, tableId]);
        await recordKnowledgeActivity(db, {
          action: "automation_updated",
          actor,
          details: {
            changedFieldIds: [...changedFieldIds],
            ruleId: rule.id,
            runId: run.id
          },
          recordId: run.recordId,
          tableId
        });
      }
      if (run.recordId && notifications.length) {
        await recordKnowledgeActivity(db, {
          action: "automation_notification",
          actor,
          details: { notifications, ruleId: rule.id, runId: run.id },
          recordId: run.recordId,
          tableId
        });
      }
      return finishAutomationRun(db, run, "succeeded", {
        changedFieldIds: [...changedFieldIds],
        matched: true,
        notifications,
        recordRevision
      });
    });
  } catch (error) {
    return markAutomationRunFailed(tableId, ruleId, runId, error);
  }
}

export async function executeKnowledgeAutomationRuns(
  runs: KnowledgeAutomationRun[],
  actor?: KnowledgeActor
) {
  const results: KnowledgeAutomationRun[] = [];
  for (const run of runs) {
    results.push(
      await executeKnowledgeAutomationRun(
        run.tableId,
        run.ruleId,
        run.id,
        actor
      )
    );
  }
  return results;
}

export async function queueKnowledgeAutomationRuns(
  db: Database,
  input: {
    actor?: KnowledgeActor;
    changedFieldIds?: string[];
    event: "record_created" | "record_updated";
    recordId: string;
    tableId: string;
  }
) {
  const triggerTypes =
    input.event === "record_created"
      ? ["record_created"]
      : ["record_updated", "field_changed"];
  const placeholders = triggerTypes.map(() => "?").join(", ");
  const rows = await getRows<RuleRow>(
    db,
    `SELECT ${RULE_SELECT} FROM knowledge_automation_rules
     WHERE table_id = ? AND enabled = 1 AND trigger_type IN (${placeholders})`,
    [input.tableId, ...triggerTypes]
  );
  const runs: KnowledgeAutomationRun[] = [];

  for (const row of rows) {
    const rule = mapRule(row);
    if (rule.triggerType === "field_changed") {
      const fieldId =
        typeof rule.triggerConfig.fieldId === "string"
          ? rule.triggerConfig.fieldId
          : undefined;
      if (
        fieldId &&
        !(input.changedFieldIds ?? []).includes(fieldId)
      ) {
        continue;
      }
    }
    const triggerPayload: Record<string, unknown> = {
      changedFieldIds: input.changedFieldIds ?? [],
      event: input.event
    };
    if (input.actor?.id) triggerPayload.actorId = input.actor.id;
    if (input.actor?.account) triggerPayload.actorAccount = input.actor.account;
    runs.push(
      await createRunWithDatabase(db, {
        recordId: input.recordId,
        ruleId: rule.id,
        tableId: input.tableId,
        triggerPayload
      })
    );
  }
  return runs;
}
