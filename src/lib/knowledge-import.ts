import {
  createKnowledgeField,
  createKnowledgeRecord,
  listKnowledgeFields,
  type KnowledgeActor,
  type KnowledgeField
} from "@/lib/knowledge-workspace";
import { KnowledgeValidationError } from "@/lib/knowledge-validation";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const MAX_IMPORT_COLUMNS = 100;
const MAX_IMPORT_ROWS = 20_000;

type CsvImportFailure = {
  message: string;
  row: number;
};

export type KnowledgeCsvImportResult = {
  createdFields: KnowledgeField[];
  failed: CsvImportFailure[];
  imported: number;
  total: number;
};

function invalid(message: string): never {
  throw new KnowledgeValidationError("INVALID_IMPORT", message);
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let cell = "";
  let quoted = false;
  let row: string[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) invalid("CSV 文件存在未闭合的引号。");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((item) => item.some((value) => value.trim().length > 0));
}

function normalizeHeaders(values: string[]) {
  const headers = values.map((value, index) => {
    const header = value.replace(/^\uFEFF/u, "").trim();
    return header || `字段 ${index + 1}`;
  });
  const normalized = headers.map((header) => header.toLocaleLowerCase("zh-CN"));
  if (new Set(normalized).size !== normalized.length) {
    invalid("CSV 表头不能包含重复字段名。");
  }
  return headers;
}

function parseImportedValue(field: KnowledgeField, raw: string) {
  const value = raw.trim();
  if (!value) return null;

  switch (field.fieldType) {
    case "checkbox":
      return /^(1|true|yes|y|是|完成|已完成)$/iu.test(value);
    case "currency":
    case "number":
    case "progress":
    case "rating": {
      const number = Number(value.replaceAll(",", ""));
      if (!Number.isFinite(number)) {
        throw new Error(`${field.name} 需要数字`);
      }
      return number;
    }
    case "attachment":
    case "multi_select":
      return value
        .split(/[;；、|]/u)
        .map((item) => item.trim())
        .filter(Boolean);
    case "autonumber":
    case "created_time":
    case "formula":
    case "lookup":
    case "updated_time":
      return undefined;
    default:
      return value;
  }
}

export async function importKnowledgeCsv(input: {
  actor: KnowledgeActor;
  bytes: Uint8Array;
  createMissingFields: boolean;
  tableId: string;
}) : Promise<KnowledgeCsvImportResult> {
  if (input.bytes.byteLength < 1) invalid("CSV 文件为空。");
  if (input.bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new KnowledgeValidationError(
      "IMPORT_TOO_LARGE",
      "CSV 文件不能超过 20MB。",
      413
    );
  }

  const source = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
  const rows = parseCsv(source);
  if (rows.length < 2) invalid("CSV 至少需要一行表头和一行数据。");
  if (rows.length - 1 > MAX_IMPORT_ROWS) invalid("CSV 数据不能超过 20,000 行。");

  const headers = normalizeHeaders(rows[0]);
  if (headers.length > MAX_IMPORT_COLUMNS) invalid("CSV 不能超过 100 列。");

  const existing = await listKnowledgeFields(input.tableId);
  const byName = new Map(
    existing.map((field) => [field.name.trim().toLocaleLowerCase("zh-CN"), field])
  );
  const createdFields: KnowledgeField[] = [];
  const mappedFields: Array<KnowledgeField | null> = [];

  for (const [index, header] of headers.entries()) {
    const key = header.toLocaleLowerCase("zh-CN");
    let field = byName.get(key);
    if (!field && input.createMissingFields) {
      field = await createKnowledgeField(input.tableId, {
        config: { imported: true },
        fieldType: "text",
        name: header,
        sortOrder: (existing.length + createdFields.length) * 10
      });
      byName.set(key, field);
      createdFields.push(field);
    }
    mappedFields[index] = field ?? null;
  }

  if (!mappedFields.some(Boolean)) {
    invalid("没有找到可导入的字段；请允许创建缺失字段或调整 CSV 表头。");
  }

  const failed: CsvImportFailure[] = [];
  let imported = 0;
  for (const [rowIndex, cells] of rows.slice(1).entries()) {
    try {
      const values: Record<string, unknown> = {};
      for (const [columnIndex, field] of mappedFields.entries()) {
        if (!field) continue;
        const value = parseImportedValue(field, cells[columnIndex] ?? "");
        if (value !== undefined) values[field.id] = value;
      }
      await createKnowledgeRecord(input.tableId, input.actor, {
        sortOrder: (existing.length + imported) * 10,
        values
      });
      imported += 1;
    } catch (error) {
      failed.push({
        message: error instanceof Error ? error.message : "该行数据格式不正确。",
        row: rowIndex + 2
      });
      if (failed.length >= 200) break;
    }
  }

  return {
    createdFields,
    failed,
    imported,
    total: rows.length - 1
  };
}

