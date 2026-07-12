import { getRows, readDatabase } from "@/lib/database";
import { KnowledgeValidationError } from "@/lib/knowledge-validation";

export type KnowledgeSearchResult = {
  id: string;
  kind: "page" | "record" | "table";
  snippet: string;
  spaceId: string;
  tableId?: string;
  title: string;
  updatedAt: string;
};

type PageSearchRow = {
  content_json: string;
  id: string;
  space_id: string;
  title: string;
  updated_at: string;
};

type TableSearchRow = {
  description: string;
  id: string;
  space_id: string;
  title: string;
  updated_at: string;
};

type RecordSearchRow = {
  id: string;
  space_id: string;
  table_id: string;
  table_title: string;
  updated_at: string;
  values_json: string;
};

function plainText(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(plainText);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(plainText);
  }
  return [];
}

function jsonText(value: string) {
  try {
    return plainText(JSON.parse(value)).join(" ");
  } catch {
    return value;
  }
}

function jsonValues(value: string) {
  try {
    return plainText(JSON.parse(value));
  } catch {
    return [value];
  }
}

function snippet(value: string, term: string) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) return "";
  const index = normalized.toLocaleLowerCase("zh-CN").indexOf(
    term.toLocaleLowerCase("zh-CN")
  );
  const start = Math.max(0, index < 0 ? 0 : index - 36);
  const text = normalized.slice(start, start + 110);
  return `${start > 0 ? "…" : ""}${text}${start + 110 < normalized.length ? "…" : ""}`;
}

function likeValue(term: string) {
  return `%${term.replace(/[\\%_]/gu, (character) => `\\${character}`)}%`;
}

export async function searchKnowledge(input: {
  limit?: number;
  query: string;
  spaceIds: string[];
}) {
  const query = input.query.trim();
  if (query.length < 2 || query.length > 100) {
    throw new KnowledgeValidationError(
      "INVALID_QUERY",
      "搜索关键词需要 2 到 100 个字符。"
    );
  }
  if (!input.spaceIds.length) return [];

  const requestedLimit = Number.isFinite(input.limit) ? input.limit as number : 50;
  const limit = Math.max(1, Math.min(50, Math.floor(requestedLimit)));
  const perType = Math.max(5, Math.ceil(limit / 3));
  const placeholders = input.spaceIds.map(() => "?").join(", ");
  const pattern = likeValue(query);

  return readDatabase(async (db) => {
    const [pages, tables, records] = await Promise.all([
      getRows<PageSearchRow>(
        db,
        `SELECT id, space_id, title, content_json, updated_at
         FROM knowledge_pages
         WHERE space_id IN (${placeholders})
           AND (title LIKE ? ESCAPE '\\\\' OR content_json LIKE ? ESCAPE '\\\\')
         ORDER BY updated_at DESC LIMIT ${perType}`,
        [...input.spaceIds, pattern, pattern]
      ),
      getRows<TableSearchRow>(
        db,
        `SELECT id, space_id, title, description, updated_at
         FROM knowledge_tables
         WHERE space_id IN (${placeholders})
           AND (title LIKE ? ESCAPE '\\\\' OR description LIKE ? ESCAPE '\\\\')
         ORDER BY updated_at DESC LIMIT ${perType}`,
        [...input.spaceIds, pattern, pattern]
      ),
      getRows<RecordSearchRow>(
        db,
        `SELECT records.id, records.table_id, tables.space_id,
                tables.title AS table_title, records.values_json,
                records.updated_at
         FROM knowledge_records records
         INNER JOIN knowledge_tables tables ON tables.id = records.table_id
         WHERE tables.space_id IN (${placeholders})
           AND records.values_json LIKE ? ESCAPE '\\\\'
         ORDER BY records.updated_at DESC LIMIT ${perType}`,
        [...input.spaceIds, pattern]
      )
    ]);

    const results: KnowledgeSearchResult[] = [
      ...pages.map((page) => ({
        id: page.id,
        kind: "page" as const,
        snippet: snippet(jsonText(page.content_json), query),
        spaceId: page.space_id,
        title: page.title,
        updatedAt: page.updated_at
      })),
      ...tables.map((table) => ({
        id: table.id,
        kind: "table" as const,
        snippet: snippet(table.description, query),
        spaceId: table.space_id,
        tableId: table.id,
        title: table.title,
        updatedAt: table.updated_at
      })),
      ...records.map((record) => {
        const text = jsonText(record.values_json);
        const values = jsonValues(record.values_json);
        return {
          id: record.id,
          kind: "record" as const,
          snippet: snippet(text, query),
          spaceId: record.space_id,
          tableId: record.table_id,
          title: values[0] || `${record.table_title} 记录`,
          updatedAt: record.updated_at
        };
      })
    ];

    return results
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  });
}
