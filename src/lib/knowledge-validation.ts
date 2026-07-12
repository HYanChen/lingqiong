export const KNOWLEDGE_BODY_LIMIT = 2 * 1024 * 1024;

export const knowledgeFieldTypes = [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
  "url",
  "person",
  "attachment",
  "phone",
  "email",
  "location",
  "barcode",
  "progress",
  "currency",
  "rating",
  "autonumber",
  "button",
  "lookup",
  "relation",
  "formula",
  "created_time",
  "updated_time"
] as const;

export type KnowledgeFieldType = (typeof knowledgeFieldTypes)[number];

export const knowledgeViewTypes = [
  "grid",
  "kanban",
  "calendar",
  "gallery",
  "gantt",
  "form"
] as const;
export type KnowledgeViewType = (typeof knowledgeViewTypes)[number];

export const knowledgePageTypes = ["document", "table", "link"] as const;
export type KnowledgePageType = (typeof knowledgePageTypes)[number];

export class KnowledgeValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(
    code: string,
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "KnowledgeValidationError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
  options: { allowEmpty?: boolean } = {}
) {
  if (typeof value !== "string") {
    throw new KnowledgeValidationError("INVALID_INPUT", `${label}必须是字符串。`);
  }

  const normalized = value.trim();

  if (!options.allowEmpty && !normalized) {
    throw new KnowledgeValidationError("INVALID_INPUT", `${label}不能为空。`);
  }

  if (normalized.length > maxLength) {
    throw new KnowledgeValidationError(
      "INPUT_TOO_LARGE",
      `${label}不能超过 ${maxLength} 个字符。`,
      413
    );
  }

  return normalized;
}

export function optionalString(
  value: unknown,
  label: string,
  maxLength: number
) {
  if (value === undefined) {
    return undefined;
  }

  return requiredString(value, label, maxLength, { allowEmpty: true });
}

export function optionalNullableId(value: unknown, label: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return requiredString(value, label, 191);
}

export function requiredRevision(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new KnowledgeValidationError(
      "REVISION_REQUIRED",
      "revision 必须是大于 0 的整数。",
      400
    );
  }

  return value as number;
}

export function optionalInteger(
  value: unknown,
  label: string,
  options: { max?: number; min?: number } = {}
) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value)) {
    throw new KnowledgeValidationError("INVALID_INPUT", `${label}必须是整数。`);
  }

  const parsed = value as number;
  const min = options.min ?? -1_000_000;
  const max = options.max ?? 1_000_000;

  if (parsed < min || parsed > max) {
    throw new KnowledgeValidationError(
      "INVALID_INPUT",
      `${label}必须在 ${min} 到 ${max} 之间。`
    );
  }

  return parsed;
}

export function optionalBoolean(value: unknown, label: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new KnowledgeValidationError("INVALID_INPUT", `${label}必须是布尔值。`);
  }

  return value;
}

export function enumValue<T extends readonly string[]>(
  value: unknown,
  label: string,
  allowed: T,
  fallback?: T[number]
) {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new KnowledgeValidationError(
      "INVALID_INPUT",
      `${label}必须是：${allowed.join("、")}。`
    );
  }

  return value as T[number];
}

function assertJsonDepth(value: unknown, depth = 0): void {
  if (depth > 12) {
    throw new KnowledgeValidationError(
      "INVALID_INPUT",
      "JSON 数据嵌套层级不能超过 12 层。"
    );
  }

  if (Array.isArray(value)) {
    if (value.length > 1000) {
      throw new KnowledgeValidationError(
        "INPUT_TOO_LARGE",
        "JSON 数组不能超过 1000 项。",
        413
      );
    }

    value.forEach((item) => assertJsonDepth(item, depth + 1));
    return;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length > 1000) {
      throw new KnowledgeValidationError(
        "INPUT_TOO_LARGE",
        "JSON 对象不能超过 1000 个字段。",
        413
      );
    }

    entries.forEach(([key, item]) => {
      if (!key || key.length > 191 || /[\u0000-\u001f]/.test(key)) {
        throw new KnowledgeValidationError("INVALID_INPUT", "JSON 字段名格式不正确。");
      }
      assertJsonDepth(item, depth + 1);
    });
    return;
  }

  if (
    value !== null &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new KnowledgeValidationError("INVALID_INPUT", "JSON 包含不支持的数据类型。");
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new KnowledgeValidationError("INVALID_INPUT", "JSON 数值必须是有限数值。");
  }

  if (typeof value === "string" && value.length > 200_000) {
    throw new KnowledgeValidationError(
      "INPUT_TOO_LARGE",
      "单个文本值不能超过 200000 个字符。",
      413
    );
  }
}

export function jsonValue(
  value: unknown,
  label: string,
  options: { maxBytes?: number; objectOnly?: boolean } = {}
) {
  if (options.objectOnly && !isPlainObject(value)) {
    throw new KnowledgeValidationError("INVALID_INPUT", `${label}必须是 JSON 对象。`);
  }

  assertJsonDepth(value);
  const maxBytes = options.maxBytes ?? 512 * 1024;

  if (Buffer.byteLength(JSON.stringify(value), "utf8") > maxBytes) {
    throw new KnowledgeValidationError(
      "INPUT_TOO_LARGE",
      `${label}不能超过 ${Math.ceil(maxBytes / 1024)}KB。`,
      413
    );
  }

  return value;
}

export function slugifyKnowledgePage(value: string, fallback: string) {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);

  return normalized || fallback.slice(0, 150);
}
