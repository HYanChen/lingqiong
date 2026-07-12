import {
  countKnowledgeRecords,
  getKnowledgeTable,
  getKnowledgeView,
  listKnowledgeFields,
  listKnowledgeRecords,
  type KnowledgeField,
  type KnowledgeRecord,
  type KnowledgeView
} from "@/lib/knowledge-workspace";
import { KnowledgeValidationError } from "@/lib/knowledge-validation";

type FilterCondition = {
  fieldId: string;
  operator: string;
  value?: unknown;
};

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(scalarText).join("、");
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function comparable(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || value === undefined) return "";
  return scalarText(value).toLocaleLowerCase("zh-CN");
}

function conditionsFromView(view: KnowledgeView) {
  const raw = view.filter.conditions;
  const conditions = Array.isArray(raw)
    ? raw
    : typeof view.filter.fieldId === "string" && typeof view.filter.operator === "string"
      ? [view.filter]
      : [];
  return conditions
    .filter(
      (condition): condition is Record<string, unknown> =>
        typeof condition === "object" && condition !== null && !Array.isArray(condition)
    )
    .map((condition): FilterCondition | null => {
      if (typeof condition.fieldId !== "string" || typeof condition.operator !== "string") {
        return null;
      }
      return {
        fieldId: condition.fieldId,
        operator: condition.operator,
        value: condition.value
      };
    })
    .filter((condition): condition is FilterCondition => Boolean(condition));
}

function matchesCondition(record: KnowledgeRecord, condition: FilterCondition) {
  const actual = record.values[condition.fieldId];
  const actualText = scalarText(actual).toLocaleLowerCase("zh-CN");
  const expectedText = scalarText(condition.value).toLocaleLowerCase("zh-CN");
  const actualComparable = comparable(actual);
  const expectedComparable = comparable(condition.value);

  switch (condition.operator) {
    case "equals":
      return actualText === expectedText;
    case "not_equals":
      return actualText !== expectedText;
    case "contains":
      return actualText.includes(expectedText);
    case "not_contains":
      return !actualText.includes(expectedText);
    case "is_empty":
      return actual === null || actual === undefined || actualText === "";
    case "is_not_empty":
      return actual !== null && actual !== undefined && actualText !== "";
    case "gt":
      return actualComparable > expectedComparable;
    case "gte":
      return actualComparable >= expectedComparable;
    case "lt":
      return actualComparable < expectedComparable;
    case "lte":
      return actualComparable <= expectedComparable;
    default:
      return true;
  }
}

function filterRecords(records: KnowledgeRecord[], view?: KnowledgeView) {
  if (!view) return records;
  const conditions = conditionsFromView(view);
  if (!conditions.length) return records;
  const conjunction = view.filter.conjunction === "or" ? "or" : "and";
  return records.filter((record) => {
    const matches = conditions.map((condition) => matchesCondition(record, condition));
    return conjunction === "or" ? matches.some(Boolean) : matches.every(Boolean);
  });
}

function sortRecords(records: KnowledgeRecord[], view?: KnowledgeView) {
  if (!view || !Array.isArray(view.sort) || !view.sort.length) return records;
  const rules = view.sort.filter(
    (rule): rule is { direction?: unknown; fieldId: string } =>
      typeof rule === "object" &&
      rule !== null &&
      !Array.isArray(rule) &&
      typeof (rule as { fieldId?: unknown }).fieldId === "string"
  );

  return [...records].sort((left, right) => {
    for (const rule of rules) {
      const leftValue = comparable(left.values[rule.fieldId]);
      const rightValue = comparable(right.values[rule.fieldId]);
      const direction = rule.direction === "desc" ? -1 : 1;
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
    }
    return left.sortOrder - right.sortOrder;
  });
}

function visibleFields(fields: KnowledgeField[], view?: KnowledgeView) {
  if (!view?.visibleFieldIds.length) return fields;
  const byId = new Map(fields.map((field) => [field.id, field]));
  return view.visibleFieldIds
    .map((fieldId) => byId.get(fieldId))
    .filter((field): field is KnowledgeField => Boolean(field));
}

function csvCell(value: unknown) {
  const raw = scalarText(value);
  // Prevent spreadsheet formula execution when user-controlled values are
  // opened in Excel, Numbers, or similar applications.
  const text = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function safeFilename(value: string) {
  const filename = value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return filename || "knowledge-table";
}

export async function exportKnowledgeTableCsv(
  spaceId: string,
  tableId: string,
  viewId?: string
) {
  const table = await getKnowledgeTable(spaceId, tableId);
  if (!table) {
    throw new KnowledgeValidationError("TABLE_NOT_FOUND", "多维表格不存在。", 404);
  }
  const [fields, total, view] = await Promise.all([
    listKnowledgeFields(tableId),
    countKnowledgeRecords(tableId),
    viewId ? getKnowledgeView(tableId, viewId) : Promise.resolve(null)
  ]);

  if (viewId && !view) {
    throw new KnowledgeValidationError("VIEW_NOT_FOUND", "导出视图不存在。", 404);
  }
  if (total > 5000) {
    throw new KnowledgeValidationError(
      "EXPORT_TOO_LARGE",
      "当前表超过 5000 条记录，请拆分表格后再导出。",
      413
    );
  }
  const records: KnowledgeRecord[] = [];
  for (let offset = 0; offset < total; offset += 500) {
    records.push(...(await listKnowledgeRecords(tableId, 500, offset)));
  }

  const columns = visibleFields(fields, view ?? undefined);
  const rows = sortRecords(filterRecords(records, view ?? undefined), view ?? undefined);
  const header = ["记录ID", ...columns.map((field) => field.name)].map(csvCell).join(",");
  const body = rows.map((record) =>
    [record.id, ...columns.map((field) => record.values[field.id])]
      .map(csvCell)
      .join(",")
  );
  const suffix = view ? `-${view.name}` : "";
  const csv = `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
  if (Buffer.byteLength(csv, "utf8") > 25 * 1024 * 1024) {
    throw new KnowledgeValidationError(
      "EXPORT_TOO_LARGE",
      "CSV 导出超过 25MB，请使用视图筛选后重试。",
      413
    );
  }
  return {
    csv,
    filename: `${safeFilename(`${table.title}${suffix}`)}.csv`,
    recordCount: rows.length,
    table,
    view
  };
}
