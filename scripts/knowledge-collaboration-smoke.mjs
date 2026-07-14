#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const baseUrl = (
  process.env.KNOWLEDGE_TEST_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost"
).replace(
  /\/+$/u,
  ""
);
const apiPrefix = (process.env.KNOWLEDGE_TEST_API_PREFIX || "/_wcu-api").replace(
  /\/+$/u,
  ""
);
function envFileValue(key) {
  for (const filename of [".env.local", ".env", ".env.baota"]) {
    if (!existsSync(filename)) continue;
    const match = readFileSync(filename, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
      .find((entry) => entry?.[1] === key);
    if (match?.[2]) return match[2].trim().replace(/^(['"])(.*)\1$/u, "$2");
  }
  return undefined;
}

const username =
  process.env.KNOWLEDGE_TEST_ADMIN_USERNAME ||
  envFileValue("ADMIN_USERNAME") ||
  "admin";
const password =
  process.env.KNOWLEDGE_TEST_ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD ||
  envFileValue("ADMIN_PASSWORD") ||
  "zhanji2026";
const serviceSecret =
  process.env.KNOWLEDGE_TEST_SERVICE_SECRET ||
  process.env.JEECG_SERVICE_SECRET ||
  envFileValue("JEECG_SERVICE_SECRET") ||
  "";

function apiUrl(path) {
  return `${baseUrl}${apiPrefix}${path.startsWith("/") ? path : `/${path}`}`;
}

function assert(condition, message, context) {
  if (!condition) {
    throw new Error(
      `${message}${context ? `\n${JSON.stringify(context, null, 2)}` : ""}`
    );
  }
}

async function request(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body && !isFormData ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    },
    redirect: "manual"
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json")
    ? await response.json().catch(() => null)
    : await response.text();
  return { body, response };
}

function expect(result, status, label) {
  assert(result.response.status === status, `${label}: expected ${status}`, {
    body: result.body,
    status: result.response.status
  });
  return result.body;
}

let cookie = "";
if (!serviceSecret) {
  const login = await request("/auth/login", {
    body: JSON.stringify({ mode: "admin", password, username }),
    method: "POST"
  });
  expect(login, 200, "admin login");
  cookie = (login.response.headers.getSetCookie?.() || [login.response.headers.get("set-cookie") || ""])
    .flatMap((header) => header.split(/,(?=\s*[^;,]+=)/u))
    .map((header) => header.split(";", 1)[0].trim())
    .filter(Boolean)
    .join("; ");
  assert(cookie.includes("wcu_platform_session="), "platform session cookie missing");
}

const authenticated = (path, options = {}) =>
  request(path, {
    ...options,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(serviceSecret
        ? { "x-lingqiong-service-secret": serviceSecret }
        : {}),
      ...(options.headers || {})
    }
  });

let checks = 0;
let cleanupVerified = false;
let space;
const checked = (condition, message, context) => {
  assert(condition, message, context);
  checks += 1;
};

try {
  const createdSpace = await authenticated("/knowledge/spaces", {
    body: JSON.stringify({
      color: "#2563eb",
      description: "reversible collaboration smoke",
      title: `知识协作测试-${Date.now()}`
    }),
    method: "POST"
  });
  expect(createdSpace, 201, "space create");
  space = createdSpace.body?.space;
  checked(Boolean(space?.id), "space id missing");
  const root = `/knowledge/spaces/${space.id}`;

  const memberCreated = await authenticated(`${root}/members`, {
    body: JSON.stringify({
      account: "collaboration.test@example.com",
      role: "commenter",
      userId: randomUUID()
    }),
    method: "POST"
  });
  expect(memberCreated, 201, "member create");
  let member = memberCreated.body?.member;
  checked(member?.role === "commenter", "member role mismatch", member);
  const memberUpdated = await authenticated(`${root}/members/${member.id}`, {
    body: JSON.stringify({ revision: member.revision, role: "editor" }),
    method: "PATCH"
  });
  expect(memberUpdated, 200, "member update");
  member = memberUpdated.body?.member;
  checked(member?.revision === 2 && member?.role === "editor", "member revision failed");

  const createdPage = await authenticated(`${root}/pages`, {
    body: JSON.stringify({
      content: { blocks: [{ text: "版本一", type: "paragraph" }], version: 1 },
      title: "协作测试页面"
    }),
    method: "POST"
  });
  expect(createdPage, 201, "page create");
  let page = createdPage.body?.page;
  checked(page?.revision === 1, "page initial revision mismatch");
  const pageUpdated = await authenticated(`${root}/pages/${page.id}`, {
    body: JSON.stringify({
      changeSummary: "smoke update",
      content: { blocks: [{ text: "版本二", type: "paragraph" }], version: 1 },
      revision: page.revision
    }),
    method: "PATCH"
  });
  expect(pageUpdated, 200, "page update");
  page = pageUpdated.body?.page;
  checked(page?.revision === 2, "page optimistic revision missing");
  expect(
    await authenticated(`${root}/pages/${page.id}`, {
      body: JSON.stringify({ revision: 1, title: "stale update" }),
      method: "PATCH"
    }),
    409,
    "page stale revision"
  );
  checks += 1;
  const versions = await authenticated(`${root}/pages/${page.id}/versions`);
  expect(versions, 200, "page versions");
  checked(versions.body?.versions?.length === 2, "page versions not captured", versions.body);
  const initialVersion = versions.body?.versions?.find(
    (version) => version.versionNumber === 1
  );
  checked(Boolean(initialVersion?.id), "initial page version missing", versions.body);
  const restored = await authenticated(
    `${root}/pages/${page.id}/versions/${initialVersion.id}/restore`,
    {
      body: JSON.stringify({ revision: page.revision }),
      method: "POST"
    }
  );
  expect(restored, 200, "page version restore");
  page = restored.body?.page;
  checked(page?.revision === 3, "page restore did not advance revision", restored.body);
  const versionsAfterRestore = await authenticated(`${root}/pages/${page.id}/versions`);
  expect(versionsAfterRestore, 200, "page versions after restore");
  checked(
    versionsAfterRestore.body?.versions?.length === 3,
    "page restore version not recorded",
    versionsAfterRestore.body
  );

  const pageCommentCreated = await authenticated(`${root}/pages/${page.id}/comments`, {
    body: JSON.stringify({ body: "页面评论" }),
    method: "POST"
  });
  expect(pageCommentCreated, 201, "page comment create");
  let pageComment = pageCommentCreated.body?.comment;
  checked(pageComment?.revision === 1, "page comment revision missing");
  const pageCommentUpdated = await authenticated(
    `${root}/pages/${page.id}/comments/${pageComment.id}`,
    {
      body: JSON.stringify({ body: "页面评论已更新", revision: pageComment.revision }),
      method: "PATCH"
    }
  );
  expect(pageCommentUpdated, 200, "page comment update");
  pageComment = pageCommentUpdated.body?.comment;
  checked(pageComment?.revision === 2, "page comment optimistic revision failed");
  expect(
    await authenticated(
      `${root}/pages/${page.id}/comments/${pageComment.id}?revision=${pageComment.revision}`,
      { method: "DELETE" }
    ),
    200,
    "page comment delete"
  );
  checks += 1;

  const tableCreated = await authenticated(`${root}/tables`, {
    body: JSON.stringify({ title: "协作测试表" }),
    method: "POST"
  });
  expect(tableCreated, 201, "table create");
  const table = tableCreated.body?.table;
  const tableRoot = `${root}/tables/${table.id}`;
  checked(Boolean(table?.id), "table id missing");
  const defaultFields = await authenticated(`${tableRoot}/fields`);
  expect(defaultFields, 200, "default table fields");
  checked(
    defaultFields.body?.fields?.length === 1 &&
      defaultFields.body.fields[0]?.name === "名称" &&
      defaultFields.body.fields[0]?.fieldType === "text",
    "new table primary field missing",
    defaultFields.body
  );
  const primaryField = defaultFields.body.fields[0];
  expect(
    await authenticated(`${tableRoot}/fields/${primaryField.id}`, {
      body: JSON.stringify({
        config: { required: true },
        revision: primaryField.revision
      }),
      method: "PATCH"
    }),
    409,
    "primary config removal rejection"
  );
  checks += 1;
  expect(
    await authenticated(`${tableRoot}/fields/${primaryField.id}`, {
      body: JSON.stringify({
        fieldType: "number",
        revision: primaryField.revision
      }),
      method: "PATCH"
    }),
    409,
    "primary type change rejection"
  );
  checks += 1;
  expect(
    await authenticated(
      `${tableRoot}/fields/${primaryField.id}?revision=${primaryField.revision}`,
      { method: "DELETE" }
    ),
    409,
    "primary field delete rejection"
  );
  checks += 1;
  const defaultViews = await authenticated(`${tableRoot}/views`);
  expect(defaultViews, 200, "default table views");
  checked(
    defaultViews.body?.views?.length === 1 &&
      defaultViews.body.views[0]?.viewType === "grid" &&
      defaultViews.body.views[0]?.isDefault === true,
    "new table default grid view missing",
    defaultViews.body
  );

  const fields = [];
  for (const input of [
    { fieldType: "text", name: "任务" },
    { fieldType: "select", name: "状态" },
    { fieldType: "date", name: "日期" },
    { fieldType: "progress", name: "进度" }
  ]) {
    const created = await authenticated(`${tableRoot}/fields`, {
      body: JSON.stringify(input),
      method: "POST"
    });
    expect(created, 201, `field ${input.name}`);
    fields.push(created.body?.field);
  }
  checked(fields.length === 4, "field creation failed");
  const [taskField, statusField, dateField, progressField] = fields;

  const viewCreated = await authenticated(`${tableRoot}/views`, {
    body: JSON.stringify({
      group: { fieldId: statusField.id },
      name: "状态看板",
      viewType: "kanban",
      visibleFieldIds: fields.map((field) => field.id)
    }),
    method: "POST"
  });
  expect(viewCreated, 201, "view create");
  const view = viewCreated.body?.view;
  checked(view?.viewType === "kanban", "kanban view missing");

  const automationCreated = await authenticated(`${tableRoot}/automations`, {
    body: JSON.stringify({
      actions: [
        { fieldId: statusField.id, type: "set_field", value: "已完成" },
        { message: "协作任务已自动完成", type: "notification" }
      ],
      conditions: {
        conditions: [
          {
            fieldId: taskField.id,
            operator: "contains",
            value: "协作"
          }
        ],
        conjunction: "and"
      },
      name: "记录更新通知",
      triggerConfig: {},
      triggerType: "record_updated"
    }),
    method: "POST"
  });
  expect(automationCreated, 201, "automation create");
  const automation = automationCreated.body?.automation;
  checked(automation?.revision === 1, "automation revision missing");
  const equalityAutomationCreated = await authenticated(`${tableRoot}/automations`, {
    body: JSON.stringify({
      actions: [
        {
          type: "update_record",
          values: { [progressField.id]: 90 }
        }
      ],
      conditions: {
        conditions: [
          {
            fieldId: taskField.id,
            operator: "equals",
            value: "可逆协作测试"
          }
        ]
      },
      name: "精确匹配进度更新",
      triggerConfig: {},
      triggerType: "record_updated"
    }),
    method: "POST"
  });
  expect(equalityAutomationCreated, 201, "equality automation create");
  const equalityAutomation = equalityAutomationCreated.body?.automation;
  checked(Boolean(equalityAutomation?.id), "equality automation id missing");
  const skippedAutomationCreated = await authenticated(`${tableRoot}/automations`, {
    body: JSON.stringify({
      actions: [{ message: "不应发送", type: "notification" }],
      conditions: {
        conditions: [
          {
            fieldId: taskField.id,
            operator: "equals",
            value: "不会匹配"
          }
        ]
      },
      name: "条件不匹配跳过",
      triggerConfig: {},
      triggerType: "record_updated"
    }),
    method: "POST"
  });
  expect(skippedAutomationCreated, 201, "skipped automation create");
  const skippedAutomation = skippedAutomationCreated.body?.automation;
  checked(Boolean(skippedAutomation?.id), "skipped automation id missing");
  const failedAutomationCreated = await authenticated(`${tableRoot}/automations`, {
    body: JSON.stringify({
      actions: [
        { fieldId: progressField.id, type: "set_field", value: "invalid-number" }
      ],
      conditions: {},
      name: "错误值失败记录",
      triggerConfig: {},
      triggerType: "record_updated"
    }),
    method: "POST"
  });
  expect(failedAutomationCreated, 201, "failed automation create");
  const failedAutomation = failedAutomationCreated.body?.automation;
  checked(Boolean(failedAutomation?.id), "failed automation id missing");

  expect(
    await authenticated(`${tableRoot}/records`, {
      body: JSON.stringify({ values: { [taskField.id]: "缺少主字段" } }),
      method: "POST"
    }),
    400,
    "required primary field create validation"
  );
  checks += 1;
  const recordCreated = await authenticated(`${tableRoot}/records`, {
    body: JSON.stringify({
      values: {
        [dateField.id]: "2026-07-30",
        [primaryField.id]: "可逆协作测试",
        [progressField.id]: 30,
        [statusField.id]: "制作中",
        [taskField.id]: "可逆协作测试"
      }
    }),
    method: "POST"
  });
  expect(recordCreated, 201, "record create");
  let record = recordCreated.body?.record;
  checked(record?.revision === 1, "record revision missing");
  const recordUpdated = await authenticated(`${tableRoot}/records/${record.id}`, {
    body: JSON.stringify({
      revision: record.revision,
      values: { ...record.values, [progressField.id]: 60 }
    }),
    method: "PATCH"
  });
  expect(recordUpdated, 200, "record update");
  record = recordUpdated.body?.record;
  checked(
    record?.revision === 4 &&
      record?.values?.[statusField.id] === "已完成" &&
      record?.values?.[progressField.id] === 90,
    "automatic actions did not update record",
    record
  );

  const activities = await authenticated(`${tableRoot}/records/${record.id}/activity`);
  expect(activities, 200, "record activities");
  checked(
    activities.body?.activities?.some((activity) => activity.action === "created") &&
      activities.body?.activities?.some((activity) => activity.action === "updated") &&
      activities.body?.activities?.some(
        (activity) => activity.action === "automation_updated"
      ),
    "record activities missing",
    activities.body
  );
  const runs = await authenticated(`${tableRoot}/automations/${automation.id}/runs`);
  expect(runs, 200, "automation runs");
  checked(
    runs.body?.runs?.length === 1 && runs.body.runs[0]?.status === "succeeded",
    "record update automation did not execute",
    runs.body
  );
  const equalityRuns = await authenticated(
    `${tableRoot}/automations/${equalityAutomation.id}/runs`
  );
  expect(equalityRuns, 200, "equality automation runs");
  checked(
    equalityRuns.body?.runs?.length === 1 &&
      equalityRuns.body.runs[0]?.status === "succeeded",
    "equals/update_record automation did not execute",
    equalityRuns.body
  );
  const skippedRuns = await authenticated(
    `${tableRoot}/automations/${skippedAutomation.id}/runs`
  );
  expect(skippedRuns, 200, "skipped automation runs");
  checked(
    skippedRuns.body?.runs?.[0]?.status === "skipped" &&
      skippedRuns.body.runs[0]?.result?.reason === "conditions_not_met",
    "unmatched conditions were not persisted as skipped",
    skippedRuns.body
  );
  const failedRuns = await authenticated(
    `${tableRoot}/automations/${failedAutomation.id}/runs`
  );
  expect(failedRuns, 200, "failed automation runs");
  checked(
    failedRuns.body?.runs?.[0]?.status === "failed" &&
      Boolean(failedRuns.body.runs[0]?.error),
    "automation execution error was not persisted",
    failedRuns.body
  );
  expect(
    await authenticated(`${tableRoot}/records/${record.id}`, {
      body: JSON.stringify({
        revision: record.revision,
        values: { [taskField.id]: "缺少主字段的更新" }
      }),
      method: "PATCH"
    }),
    400,
    "required primary field update validation"
  );
  checks += 1;
  for (const index of [2, 3]) {
    const extraRecord = await authenticated(`${tableRoot}/records`, {
      body: JSON.stringify({
        values: {
          [primaryField.id]: `分页记录 ${index}`,
          [taskField.id]: `分页任务 ${index}`
        }
      }),
      method: "POST"
    });
    expect(extraRecord, 201, `pagination record ${index}`);
  }
  const firstPage = await authenticated(`${tableRoot}/records?limit=2&offset=0`);
  expect(firstPage, 200, "record pagination first page");
  checked(
    firstPage.body?.records?.length === 2 &&
      firstPage.body?.total === 3 &&
      firstPage.body?.hasMore === true &&
      firstPage.body?.offset === 0,
    "first record page metadata mismatch",
    firstPage.body
  );
  const secondPage = await authenticated(`${tableRoot}/records?limit=2&offset=2`);
  expect(secondPage, 200, "record pagination second page");
  checked(
    secondPage.body?.records?.length === 1 &&
      secondPage.body?.total === 3 &&
      secondPage.body?.hasMore === false &&
      secondPage.body?.offset === 2,
    "second record page metadata mismatch",
    secondPage.body
  );
  const tableBootstrap = await authenticated(
    `/knowledge?spaceId=${encodeURIComponent(space.id)}&tableId=${encodeURIComponent(table.id)}`
  );
  expect(tableBootstrap, 200, "table bootstrap pagination metadata");
  checked(
    tableBootstrap.body?.recordTotal === 3 &&
      tableBootstrap.body?.recordHasMore === false,
    "bootstrap record metadata mismatch",
    tableBootstrap.body
  );
  const tableAfterRecordWrites = (await authenticated(tableRoot)).body?.table;
  checked(
    tableAfterRecordWrites?.updatedAt > table.updatedAt,
    "record writes did not update table timestamp",
    tableAfterRecordWrites
  );
  const manualRunCreated = await authenticated(
    `${tableRoot}/automations/${automation.id}/runs`,
    {
      body: JSON.stringify({
        recordId: record.id,
        triggerPayload: { source: "smoke" }
      }),
      method: "POST"
    }
  );
  expect(manualRunCreated, 202, "manual automation run");
  let manualRun = manualRunCreated.body?.run;
  checked(manualRun?.status === "queued", "manual run was not queued");
  const manualRunExecuted = await authenticated(
    `${tableRoot}/automations/${automation.id}/runs/${manualRun.id}/execute`,
    { method: "POST" }
  );
  expect(manualRunExecuted, 200, "automation run execute");
  manualRun = manualRunExecuted.body?.run;
  checked(
    manualRun?.status === "succeeded" &&
      manualRun?.revision === 3 &&
      manualRun?.result?.notifications?.length === 1,
    "manual executor result mismatch",
    manualRun
  );

  const recordCommentCreated = await authenticated(`${tableRoot}/records/${record.id}/comments`, {
    body: JSON.stringify({ body: "记录评论" }),
    method: "POST"
  });
  expect(recordCommentCreated, 201, "record comment create");
  let recordComment = recordCommentCreated.body?.comment;
  checked(recordComment?.body === "记录评论", "record comment mismatch");
  const recordCommentUpdated = await authenticated(
    `${tableRoot}/records/${record.id}/comments/${recordComment.id}`,
    {
      body: JSON.stringify({ body: "记录评论已更新", revision: recordComment.revision }),
      method: "PATCH"
    }
  );
  expect(recordCommentUpdated, 200, "record comment update");
  recordComment = recordCommentUpdated.body?.comment;
  checked(recordComment?.revision === 2, "record comment revision failed");
  expect(
    await authenticated(
      `${tableRoot}/records/${record.id}/comments/${recordComment.id}?revision=${recordComment.revision}`,
      { method: "DELETE" }
    ),
    200,
    "record comment delete"
  );
  checks += 1;

  const csv = await authenticated(`${tableRoot}/export?viewId=${encodeURIComponent(view.id)}`);
  expect(csv, 200, "view csv export");
  checked(
    csv.response.headers.get("content-type")?.includes("text/csv") &&
      typeof csv.body === "string" &&
      csv.body.includes("可逆协作测试"),
    "csv export invalid"
  );
  const bulkCsv = [
    "名称,任务",
    ...Array.from(
      { length: 501 },
      (_, index) => `批量记录 ${index + 1},批量任务 ${index + 1}`
    )
  ].join("\r\n");
  const importForm = new FormData();
  importForm.append("file", new Blob([bulkCsv], { type: "text/csv" }), "bulk.csv");
  const bulkImport = await authenticated(`${tableRoot}/import`, {
    body: importForm,
    method: "POST"
  });
  expect(bulkImport, 200, "bulk csv import");
  checked(
    bulkImport.body?.imported === 501 && bulkImport.body?.failed?.length === 0,
    "bulk csv import mismatch",
    bulkImport.body
  );
  const largeCsv = await authenticated(
    `${tableRoot}/export?viewId=${encodeURIComponent(view.id)}`
  );
  expect(largeCsv, 200, "csv export beyond 500 records");
  checked(
    typeof largeCsv.body === "string" &&
      largeCsv.body.includes("批量任务 501") &&
      largeCsv.body.split(/\r?\n/u).filter(Boolean).length === 505,
    "csv export truncated beyond 500 records"
  );

  expect(
    await authenticated(`${root}/members/${member.id}?revision=${member.revision}`, {
      method: "DELETE"
    }),
    200,
    "member delete"
  );
  checks += 1;

  const pageMoved = await authenticated(
    `${root}/pages/${page.id}?revision=${page.revision}`,
    { method: "DELETE" }
  );
  expect(pageMoved, 200, "page move to trash");
  let pageTrash = pageMoved.body?.trashItem;
  checked(
    pageMoved.body?.movedToTrash === true && pageTrash?.revision === page.revision + 1,
    "page trash response mismatch",
    pageMoved.body
  );
  expect(await authenticated(`${root}/pages/${page.id}`), 404, "trashed page hidden");
  checks += 1;
  const trashAfterPage = await authenticated(`${root}/trash`);
  expect(trashAfterPage, 200, "trash list after page");
  checked(
    trashAfterPage.body?.items?.some(
      (item) => item.id === page.id && item.resourceType === "page"
    ),
    "trashed page missing from list",
    trashAfterPage.body
  );
  const pageRestored = await authenticated(
    `${root}/trash/page/${page.id}/restore`,
    {
      body: JSON.stringify({ revision: pageTrash.revision }),
      method: "POST"
    }
  );
  expect(pageRestored, 200, "page restore");
  page = (await authenticated(`${root}/pages/${page.id}`)).body?.page;
  checked(page?.revision === pageTrash.revision + 1, "restored page revision mismatch");
  const pageMovedAgain = await authenticated(
    `${root}/pages/${page.id}?revision=${page.revision}`,
    { method: "DELETE" }
  );
  expect(pageMovedAgain, 200, "page second move to trash");
  pageTrash = pageMovedAgain.body?.trashItem;
  expect(
    await authenticated(
      `${root}/trash/page/${page.id}?revision=${pageTrash.revision}`,
      { method: "DELETE" }
    ),
    200,
    "page permanent delete"
  );
  checks += 1;

  const tableMoved = await authenticated(
    `${root}/tables/${table.id}?revision=${table.revision}`,
    { method: "DELETE" }
  );
  expect(tableMoved, 200, "table move to trash");
  let tableTrash = tableMoved.body?.trashItem;
  checked(tableTrash?.revision === table.revision + 1, "table trash revision mismatch");
  expect(await authenticated(tableRoot), 404, "trashed table hidden");
  checks += 1;
  const tableRestored = await authenticated(
    `${root}/trash/table/${table.id}/restore`,
    {
      body: JSON.stringify({ revision: tableTrash.revision }),
      method: "POST"
    }
  );
  expect(tableRestored, 200, "table restore");
  const restoredTable = (await authenticated(tableRoot)).body?.table;
  checked(
    restoredTable?.revision === tableTrash.revision + 1,
    "restored table revision mismatch"
  );
  const tableMovedAgain = await authenticated(
    `${root}/tables/${table.id}?revision=${restoredTable.revision}`,
    { method: "DELETE" }
  );
  expect(tableMovedAgain, 200, "table second move to trash");
  tableTrash = tableMovedAgain.body?.trashItem;
  expect(
    await authenticated(
      `${root}/trash/table/${table.id}?revision=${tableTrash.revision}`,
      { method: "DELETE" }
    ),
    200,
    "table permanent delete"
  );
  checks += 1;
} finally {
  if (space?.id) {
    const cleanup = await authenticated(
      `/knowledge/spaces/${space.id}?revision=${space.revision}`,
      { method: "DELETE" }
    ).catch(() => null);
    if (cleanup?.response.status === 200) {
      const afterCleanup = await authenticated(`/knowledge/spaces/${space.id}`).catch(
        () => null
      );
      cleanupVerified = afterCleanup?.response.status === 404;
    }
  }
}

assert(cleanupVerified, "knowledge smoke cleanup was not verified");
checks += 1;
console.log(JSON.stringify({ checks, cleanup: cleanupVerified, ok: true }, null, 2));
