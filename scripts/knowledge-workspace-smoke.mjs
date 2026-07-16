#!/usr/bin/env node

import { Blob } from "node:buffer";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function envFileValue(key) {
  for (const filename of [".env.local", ".env", ".env.baota", ".env.new-api.example"]) {
    if (!existsSync(filename)) continue;
    const match = readFileSync(filename, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
      .find((entry) => entry?.[1] === key);
    if (match?.[2]) return match[2].trim().replace(/^(['"])(.*)\1$/u, "$2");
  }
  return undefined;
}

const baseUrl = (
  process.env.KNOWLEDGE_TEST_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost"
).replace(
  /\/+$/u,
  ""
);
const localServiceSecret = ["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname)
  ? "zhanji-jeecg-service-local-secret"
  : "";
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
  localServiceSecret;
const apiRoot = `${baseUrl}/_wcu-api/knowledge`;
const checks = [];
const cleanupTasks = [];
const cookies = new Map();
let testSpace = null;

function captureCookies(response) {
  const headers =
    response.headers.getSetCookie?.() ??
    [response.headers.get("set-cookie")].filter(Boolean);

  for (const header of headers) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }
}

function cookieHeader() {
  return [...cookies]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function redactSecrets(value, depth = 0) {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => redactSecrets(item, depth + 1));
  }
  if (!value || typeof value !== "object") return value;
  if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`;

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 60)
      .map(([key, item]) => [
        key,
        /authorization|cookie|password|secret|token/iu.test(key)
          ? "[redacted]"
          : redactSecrets(item, depth + 1)
      ])
  );
}

function describeBody(body) {
  if (body instanceof Uint8Array) return `<${body.byteLength} bytes>`;
  if (typeof body === "string") {
    return JSON.stringify(body.length > 800 ? `${body.slice(0, 800)}…` : body);
  }

  try {
    const serialized = JSON.stringify(redactSecrets(body));
    return serialized.length > 1200 ? `${serialized.slice(0, 1200)}…` : serialized;
  } catch {
    return "[unserializable response]";
  }
}

async function request(url, options = {}) {
  const {
    headers: optionHeaders,
    json,
    responseType = "auto",
    ...fetchOptions
  } = options;
  const headers = new Headers(optionHeaders || {});
  let body = fetchOptions.body;

  if (json !== undefined) {
    if (body !== undefined) {
      throw new Error("request 不能同时设置 json 和 body");
    }
    body = JSON.stringify(json);
    headers.set("content-type", "application/json");
  } else if (body instanceof FormData) {
    // Let fetch add the multipart boundary. Manually setting Content-Type
    // would make the payload impossible for the server to parse.
    headers.delete("content-type");
  }

  if (!headers.has("accept")) {
    headers.set(
      "accept",
      responseType === "bytes"
        ? "*/*"
        : "application/json, text/plain;q=0.9, */*;q=0.8"
    );
  }

  if (serviceSecret) {
    headers.set("x-lingqiong-service-secret", serviceSecret);
  }

  const sessionCookies = cookieHeader();
  if (sessionCookies) headers.set("cookie", sessionCookies);

  const response = await fetch(url, {
    ...fetchOptions,
    body,
    headers,
    redirect: "manual"
  });
  captureCookies(response);

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  let responseBody = null;

  if (responseType === "bytes") {
    responseBody = new Uint8Array(await response.arrayBuffer());
  } else if (response.status !== 204) {
    const text = await response.text();
    if (responseType === "text") {
      responseBody = text;
    } else if (contentType.includes("application/json") || contentType.includes("+json")) {
      try {
        responseBody = text ? JSON.parse(text) : null;
      } catch {
        responseBody = text;
      }
    } else {
      responseBody = text;
    }
  }

  return { body: responseBody, response };
}

function expect(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(
      `${label}：预期 HTTP ${status}，实际 ${result.response.status} ${describeBody(result.body)}`
    );
  }
  checks.push(label);
  return result.body;
}

function verify(condition, label, detail = "响应内容不符合预期") {
  if (!condition) throw new Error(`${label}：${detail}`);
  checks.push(label);
}

function resource(body, key, label) {
  const value = body?.[key];
  verify(
    value &&
      typeof value === "object" &&
      typeof value.id === "string" &&
      Number.isInteger(value.revision) &&
      value.revision > 0,
    `${label}响应结构`
  );
  return value;
}

function deferCleanup(label, operation) {
  const task = { active: true, label, operation };
  cleanupTasks.push(task);
  return () => {
    task.active = false;
  };
}

async function cleanupDelete(url, label) {
  const result = await request(url, { method: "DELETE" });
  if (![200, 404].includes(result.response.status)) {
    throw new Error(
      `${label}：预期 HTTP 200/404，实际 ${result.response.status} ${describeBody(result.body)}`
    );
  }
}

async function runCleanupTasks() {
  const errors = [];

  for (const task of [...cleanupTasks].reverse()) {
    if (!task.active) continue;
    try {
      await task.operation();
      checks.push(task.label);
    } catch (error) {
      errors.push(
        `${task.label}：${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      task.active = false;
    }
  }

  cleanupTasks.length = 0;
  return errors;
}

function pageText(pageOrVersion) {
  const blocks = pageOrVersion?.content?.blocks;
  return Array.isArray(blocks) && typeof blocks[0]?.text === "string"
    ? blocks[0].text
    : "";
}

function scopedRoot(spaceId, tableId) {
  return `${apiRoot}/spaces/${encodeURIComponent(spaceId)}/tables/${encodeURIComponent(tableId)}`;
}

async function runScenario() {
  const workbench = await request(`${baseUrl}/knowledge`);
  if (serviceSecret) {
    expect(workbench, 307, "知识工作台前台登录保护");
  } else {
    expect(workbench, 200, "知识工作台页面");
  }

  const bootstrap = expect(await request(apiRoot), 200, "知识库启动接口");
  verify(
    bootstrap?.ok && bootstrap.dashboard && Array.isArray(bootstrap.spaces),
    "知识库启动响应结构"
  );

  const suffix = randomUUID().slice(0, 8);
  const createdSpace = expect(
    await request(`${apiRoot}/spaces`, {
      json: {
        color: "#22d3ee",
        description: "可逆自动化验收空间",
        icon: "book-open",
        title: `知识库验收-${suffix}`
      },
      method: "POST"
    }),
    201,
    "创建知识空间"
  );
  testSpace = resource(createdSpace, "space", "创建知识空间");
  const spaceRoot = `${apiRoot}/spaces/${encodeURIComponent(testSpace.id)}`;

  deferCleanup("清理测试知识空间", async () => {
    if (!testSpace) return;
    await cleanupDelete(
      `${spaceRoot}?revision=${encodeURIComponent(testSpace.revision)}`,
      "清理测试知识空间"
    );
    testSpace = null;
  });

  let member = resource(
    expect(
      await request(`${spaceRoot}/members`, {
        json: {
          account: `smoke-${suffix}@example.invalid`,
          role: "viewer",
          userId: `knowledge-smoke-member-${suffix}`
        },
        method: "POST"
      }),
      201,
      "创建空间成员"
    ),
    "member",
    "创建空间成员"
  );
  const cancelMemberCleanup = deferCleanup("兜底清理空间成员", () =>
    cleanupDelete(
      `${spaceRoot}/members/${encodeURIComponent(member.id)}?revision=${encodeURIComponent(member.revision)}`,
      "兜底清理空间成员"
    )
  );

  const memberList = expect(
    await request(`${spaceRoot}/members`),
    200,
    "列出空间成员"
  );
  verify(
    Array.isArray(memberList?.members) &&
      memberList.members.some((item) => item.id === member.id),
    "空间成员列表包含新成员"
  );

  member = resource(
    expect(
      await request(`${spaceRoot}/members/${encodeURIComponent(member.id)}`, {
        json: {
          account: `smoke-updated-${suffix}@example.invalid`,
          revision: member.revision,
          role: "commenter"
        },
        method: "PATCH"
      }),
      200,
      "更新空间成员"
    ),
    "member",
    "更新空间成员"
  );
  verify(
    member.role === "commenter" && member.revision === 2,
    "空间成员角色与 revision 已更新"
  );

  expect(
    await request(
      `${spaceRoot}/members/${encodeURIComponent(member.id)}?revision=${encodeURIComponent(member.revision)}`,
      { method: "DELETE" }
    ),
    200,
    "删除空间成员"
  );
  cancelMemberCleanup();
  const membersAfterDelete = expect(
    await request(`${spaceRoot}/members`),
    200,
    "删除后重新列出空间成员"
  );
  verify(
    Array.isArray(membersAfterDelete?.members) &&
      !membersAfterDelete.members.some((item) => item.id === member.id),
    "空间成员已从列表移除"
  );

  let rootPage = resource(
    expect(
      await request(`${spaceRoot}/pages`, {
        json: {
          changeSummary: "冒烟创建",
          content: {
            blocks: [{ text: "验收正文", type: "paragraph" }],
            version: 1
          },
          icon: "file-text",
          pageType: "document",
          title: "验收文档"
        },
        method: "POST"
      }),
      201,
      "创建知识页面"
    ),
    "page",
    "创建知识页面"
  );

  let childPage = resource(
    expect(
      await request(`${spaceRoot}/pages`, {
        json: {
          content: { blocks: [], version: 1 },
          icon: "file-text",
          pageType: "document",
          parentId: rootPage.id,
          title: "子页面"
        },
        method: "POST"
      }),
      201,
      "创建层级子页面"
    ),
    "page",
    "创建层级子页面"
  );

  const reordered = expect(
    await request(`${spaceRoot}/pages/reorder`, {
      json: {
        items: [
          {
            id: rootPage.id,
            parentId: null,
            revision: rootPage.revision,
            sortOrder: 10
          },
          {
            id: childPage.id,
            parentId: rootPage.id,
            revision: childPage.revision,
            sortOrder: 20
          }
        ]
      },
      method: "PATCH"
    }),
    200,
    "页面层级重排"
  );
  verify(Array.isArray(reordered?.pages), "页面层级重排响应结构");
  rootPage = reordered.pages.find((page) => page.id === rootPage.id);
  childPage = reordered.pages.find((page) => page.id === childPage.id);
  verify(
    rootPage?.revision === 2 &&
      childPage?.revision === 2 &&
      childPage.parentId === rootPage.id,
    "页面层级与 revision 已更新"
  );

  const stalePageRevision = rootPage.revision;
  let updatedPage = resource(
    expect(
      await request(`${spaceRoot}/pages/${encodeURIComponent(rootPage.id)}`, {
        json: {
          changeSummary: "冒烟更新",
          content: {
            blocks: [{ text: "更新后的验收正文", type: "paragraph" }],
            version: 1
          },
          revision: stalePageRevision,
          title: "验收文档已更新"
        },
        method: "PATCH"
      }),
      200,
      "更新知识页面"
    ),
    "page",
    "更新知识页面"
  );

  expect(
    await request(`${spaceRoot}/pages/${encodeURIComponent(rootPage.id)}`, {
      json: { revision: stalePageRevision, title: "过期写入" },
      method: "PATCH"
    }),
    409,
    "页面 revision 冲突保护"
  );

  const versionsRoot = `${spaceRoot}/pages/${encodeURIComponent(rootPage.id)}/versions`;
  const versionList = expect(
    await request(versionsRoot),
    200,
    "列出页面版本"
  );
  verify(
    Array.isArray(versionList?.versions) && versionList.versions.length >= 2,
    "页面版本列表包含创建与更新版本"
  );
  const originalVersion = [...versionList.versions].sort(
    (left, right) => left.versionNumber - right.versionNumber
  )[0];
  const versionDetail = expect(
    await request(`${versionsRoot}/${encodeURIComponent(originalVersion.id)}`),
    200,
    "读取单个页面版本"
  );
  verify(
    versionDetail?.version?.id === originalVersion.id &&
      pageText(versionDetail.version) === "验收正文",
    "页面版本内容正确"
  );

  const restored = expect(
    await request(
      `${versionsRoot}/${encodeURIComponent(originalVersion.id)}/restore`,
      {
        json: { revision: updatedPage.revision },
        method: "POST"
      }
    ),
    200,
    "恢复页面历史版本"
  );
  updatedPage = resource(restored, "page", "恢复页面历史版本");
  verify(
    updatedPage.revision === stalePageRevision + 2 &&
      updatedPage.title === "验收文档" &&
      pageText(updatedPage) === "验收正文",
    "页面版本恢复内容与 revision 正确"
  );
  const versionsAfterRestore = expect(
    await request(versionsRoot),
    200,
    "恢复后重新列出页面版本"
  );
  verify(
    versionsAfterRestore.versions.length > versionList.versions.length,
    "恢复操作生成新页面版本"
  );

  const pageCommentsRoot = `${spaceRoot}/pages/${encodeURIComponent(rootPage.id)}/comments`;
  let pageComment = resource(
    expect(
      await request(pageCommentsRoot, {
        json: { body: `页面评论-${suffix}` },
        method: "POST"
      }),
      201,
      "创建页面评论"
    ),
    "comment",
    "创建页面评论"
  );
  const cancelPageCommentCleanup = deferCleanup("兜底清理页面评论", () =>
    cleanupDelete(
      `${pageCommentsRoot}/${encodeURIComponent(pageComment.id)}?revision=${encodeURIComponent(pageComment.revision)}`,
      "兜底清理页面评论"
    )
  );
  const pageComments = expect(
    await request(pageCommentsRoot),
    200,
    "列出页面评论"
  );
  verify(
    Array.isArray(pageComments?.comments) &&
      pageComments.comments.some((comment) => comment.id === pageComment.id),
    "页面评论列表包含新评论"
  );
  pageComment = resource(
    expect(
      await request(`${pageCommentsRoot}/${encodeURIComponent(pageComment.id)}`, {
        json: {
          body: `页面评论已更新-${suffix}`,
          revision: pageComment.revision,
          status: "resolved"
        },
        method: "PATCH"
      }),
      200,
      "更新页面评论"
    ),
    "comment",
    "更新页面评论"
  );
  verify(
    pageComment.revision === 2 && pageComment.status === "resolved",
    "页面评论状态与 revision 已更新"
  );
  expect(
    await request(
      `${pageCommentsRoot}/${encodeURIComponent(pageComment.id)}?revision=${encodeURIComponent(pageComment.revision)}`,
      { method: "DELETE" }
    ),
    200,
    "删除页面评论"
  );
  cancelPageCommentCleanup();
  const pageCommentsAfterDelete = expect(
    await request(pageCommentsRoot),
    200,
    "删除后重新列出页面评论"
  );
  verify(
    Array.isArray(pageCommentsAfterDelete?.comments) &&
      pageCommentsAfterDelete.comments.some(
        (comment) => comment.id === pageComment.id && comment.status === "deleted"
      ),
    "页面评论已软删除"
  );

  const table = resource(
    expect(
      await request(`${spaceRoot}/tables`, {
        json: {
          description: "验收多维表格",
          icon: "table-2",
          title: "素材验收表"
        },
        method: "POST"
      }),
      201,
      "创建多维表格"
    ),
    "table",
    "创建多维表格"
  );
  const tableRoot = scopedRoot(testSpace.id, table.id);
  const initialFields = expect(
    await request(`${tableRoot}/fields`),
    200,
    "读取新表默认字段"
  );
  const primaryField = initialFields.fields?.find(
    (field) => field.config?.primary === true
  );
  verify(
    primaryField?.name === "名称" && primaryField.config?.required === true,
    "新表自动创建必填主字段"
  );

  const nameField = resource(
    expect(
      await request(`${tableRoot}/fields`, {
        json: {
          config: { required: true },
          fieldType: "text",
          name: "素材名称",
          sortOrder: 0
        },
        method: "POST"
      }),
      201,
      "创建文本字段"
    ),
    "field",
    "创建文本字段"
  );
  const statusField = resource(
    expect(
      await request(`${tableRoot}/fields`, {
        json: {
          config: {
            options: [
              { color: "blue", label: "制作中" },
              { color: "green", label: "已完成" }
            ]
          },
          fieldType: "select",
          name: "状态",
          sortOrder: 10
        },
        method: "POST"
      }),
      201,
      "创建单选字段"
    ),
    "field",
    "创建单选字段"
  );

  let record = resource(
    expect(
      await request(`${tableRoot}/records`, {
        json: {
          values: {
            [primaryField.id]: "主角定妆记录",
            [nameField.id]: "主角定妆",
            [statusField.id]: "制作中"
          }
        },
        method: "POST"
      }),
      201,
      "创建多维表记录"
    ),
    "record",
    "创建多维表记录"
  );
  const recordRoot = `${tableRoot}/records/${encodeURIComponent(record.id)}`;

  expect(
    await request(`${tableRoot}/views`, {
      json: {
        filter: {},
        frozenFieldCount: 1,
        group: { fieldId: statusField.id },
        isDefault: true,
        name: "状态看板",
        rowHeight: "medium",
        sort: [],
        viewType: "kanban",
        visibleFieldIds: [primaryField.id, nameField.id, statusField.id]
      },
      method: "POST"
    }),
    201,
    "创建看板视图"
  );

  const tableBootstrap = expect(
    await request(`${apiRoot}?spaceId=${encodeURIComponent(testSpace.id)}&tableId=${encodeURIComponent(table.id)}`),
    200,
    "读取多维表完整数据"
  );
  verify(
    tableBootstrap.fields.length === 3 &&
      tableBootstrap.records.length === 1 &&
      tableBootstrap.views.length === 2,
    "多维表完整数据数量正确"
  );

  record = resource(
    expect(
      await request(recordRoot, {
        json: {
          revision: record.revision,
          values: {
            [primaryField.id]: "主角定妆记录",
            [nameField.id]: "主角定妆",
            [statusField.id]: "已完成"
          }
        },
        method: "PATCH"
      }),
      200,
      "更新多维表记录"
    ),
    "record",
    "更新多维表记录"
  );

  const recordCommentsRoot = `${recordRoot}/comments`;
  let recordComment = resource(
    expect(
      await request(recordCommentsRoot, {
        json: { body: `记录评论-${suffix}` },
        method: "POST"
      }),
      201,
      "创建记录评论"
    ),
    "comment",
    "创建记录评论"
  );
  const cancelRecordCommentCleanup = deferCleanup("兜底清理记录评论", () =>
    cleanupDelete(
      `${recordCommentsRoot}/${encodeURIComponent(recordComment.id)}?revision=${encodeURIComponent(recordComment.revision)}`,
      "兜底清理记录评论"
    )
  );
  const recordComments = expect(
    await request(recordCommentsRoot),
    200,
    "列出记录评论"
  );
  verify(
    Array.isArray(recordComments?.comments) &&
      recordComments.comments.some((comment) => comment.id === recordComment.id),
    "记录评论列表包含新评论"
  );
  recordComment = resource(
    expect(
      await request(`${recordCommentsRoot}/${encodeURIComponent(recordComment.id)}`, {
        json: {
          body: `记录评论已更新-${suffix}`,
          revision: recordComment.revision,
          status: "resolved"
        },
        method: "PATCH"
      }),
      200,
      "更新记录评论"
    ),
    "comment",
    "更新记录评论"
  );
  expect(
    await request(
      `${recordCommentsRoot}/${encodeURIComponent(recordComment.id)}?revision=${encodeURIComponent(recordComment.revision)}`,
      { method: "DELETE" }
    ),
    200,
    "删除记录评论"
  );
  cancelRecordCommentCleanup();
  const recordCommentsAfterDelete = expect(
    await request(recordCommentsRoot),
    200,
    "删除后重新列出记录评论"
  );
  verify(
    Array.isArray(recordCommentsAfterDelete?.comments) &&
      recordCommentsAfterDelete.comments.some(
        (comment) => comment.id === recordComment.id && comment.status === "deleted"
      ),
    "记录评论已软删除"
  );

  const activities = expect(
    await request(`${recordRoot}/activity?limit=100`),
    200,
    "读取记录活动"
  );
  const activityActions = new Set(
    Array.isArray(activities?.activities)
      ? activities.activities.map((activity) => activity.action)
      : []
  );
  verify(
    ["created", "updated", "commented", "comment_deleted"].every((action) =>
      activityActions.has(action)
    ),
    "记录活动包含创建、更新与评论事件"
  );

  const automationsRoot = `${tableRoot}/automations`;
  let automation = resource(
    expect(
      await request(automationsRoot, {
        json: {
          actions: [{ message: `automation-${suffix}`, type: "notification" }],
          conditions: {},
          enabled: true,
          name: `手动验收规则-${suffix}`,
          triggerConfig: {},
          triggerType: "manual"
        },
        method: "POST"
      }),
      201,
      "创建自动化规则"
    ),
    "automation",
    "创建自动化规则"
  );
  const cancelAutomationCleanup = deferCleanup("兜底清理自动化规则", () =>
    cleanupDelete(
      `${automationsRoot}/${encodeURIComponent(automation.id)}?revision=${encodeURIComponent(automation.revision)}`,
      "兜底清理自动化规则"
    )
  );
  const automationList = expect(
    await request(automationsRoot),
    200,
    "列出自动化规则"
  );
  verify(
    Array.isArray(automationList?.automations) &&
      automationList.automations.some((rule) => rule.id === automation.id),
    "自动化列表包含新规则"
  );

  const runsRoot = `${automationsRoot}/${encodeURIComponent(automation.id)}/runs`;
  let automationRun = resource(
    expect(
      await request(runsRoot, {
        json: {
          recordId: record.id,
          triggerPayload: { source: "knowledge-smoke", suffix }
        },
        method: "POST"
      }),
      202,
      "手动触发自动化运行"
    ),
    "run",
    "手动触发自动化运行"
  );
  verify(automationRun.status === "queued", "自动化运行进入排队状态");
  automationRun = resource(
    expect(
      await request(
        `${runsRoot}/${encodeURIComponent(automationRun.id)}/execute`,
        { method: "POST" }
      ),
      200,
      "执行自动化运行"
    ),
    "run",
    "执行自动化运行"
  );
  verify(
    automationRun.status === "succeeded" &&
      Array.isArray(automationRun.result?.notifications) &&
      automationRun.result.notifications.length === 1,
    "自动化通知真实执行并持久化结果"
  );
  const automationRuns = expect(
    await request(runsRoot),
    200,
    "列出自动化运行"
  );
  verify(
    Array.isArray(automationRuns?.runs) &&
      automationRuns.runs.some((run) => run.id === automationRun.id),
    "自动化运行列表包含手动任务"
  );

  automation = resource(
    expect(
      await request(`${automationsRoot}/${encodeURIComponent(automation.id)}`, {
        json: {
          enabled: false,
          name: `手动验收规则已更新-${suffix}`,
          revision: automation.revision
        },
        method: "PATCH"
      }),
      200,
      "更新自动化规则"
    ),
    "automation",
    "更新自动化规则"
  );
  verify(
    automation.enabled === false && automation.revision === 2,
    "自动化规则状态与 revision 已更新"
  );
  expect(
    await request(
      `${automationsRoot}/${encodeURIComponent(automation.id)}?revision=${encodeURIComponent(automation.revision)}`,
      { method: "DELETE" }
    ),
    200,
    "删除自动化规则"
  );
  cancelAutomationCleanup();

  const importCsv = [
    "名称,素材名称,状态,导入备注",
    `CSV主记录,CSV导入素材,制作中,=1+1`
  ].join("\r\n");
  const importForm = new FormData();
  importForm.append(
    "file",
    new Blob([`\uFEFF${importCsv}\r\n`], { type: "text/csv" }),
    `knowledge-smoke-${suffix}.csv`
  );
  importForm.append("createMissingFields", "true");
  const imported = expect(
    await request(`${tableRoot}/import`, {
      body: importForm,
      method: "POST"
    }),
    200,
    "CSV multipart 导入"
  );
  verify(
    imported?.imported === 1 &&
      imported.total === 1 &&
      Array.isArray(imported.failed) &&
      imported.failed.length === 0,
    "CSV 导入数量正确"
  );
  verify(
    imported.createdFields?.some((field) => field.name === "导入备注"),
    "CSV 导入创建缺失字段"
  );

  const afterImport = expect(
    await request(`${apiRoot}?spaceId=${encodeURIComponent(testSpace.id)}&tableId=${encodeURIComponent(table.id)}`),
    200,
    "CSV 导入后读取多维表"
  );
  verify(
    afterImport.fields.length === 4 &&
      afterImport.records.length === 2 &&
      afterImport.records.some(
        (item) => item.values?.[nameField.id] === "CSV导入素材"
      ),
    "CSV 导入内容已持久化"
  );

  const exportedResult = await request(`${tableRoot}/export`, {
    responseType: "text"
  });
  const exportedCsv = expect(exportedResult, 200, "导出多维表 CSV");
  verify(
    exportedResult.response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("text/csv") &&
      exportedResult.response.headers.get("x-knowledge-record-count") === "2",
    "CSV 导出响应头正确"
  );
  const normalizedCsv =
    typeof exportedCsv === "string"
      ? exportedCsv.replace(/^\uFEFF/u, "")
      : exportedCsv;
  verify(
    typeof normalizedCsv === "string" &&
      normalizedCsv.startsWith("记录ID,名称,素材名称,状态,导入备注") &&
      normalizedCsv.includes("主角定妆") &&
      normalizedCsv.includes("CSV导入素材") &&
      normalizedCsv.includes("'=1+1"),
    "CSV 导出内容与公式防护正确"
  );

  const attachmentContent = `knowledge-attachment-${suffix}\n`;
  const attachmentForm = new FormData();
  attachmentForm.append(
    "file",
    new Blob([attachmentContent], { type: "text/plain" }),
    `../../知识库附件-${suffix}.txt`
  );
  const attachmentsRoot = `${recordRoot}/attachments`;
  let attachment = resource(
    expect(
      await request(attachmentsRoot, {
        body: attachmentForm,
        method: "POST"
      }),
      201,
      "上传记录附件"
    ),
    "attachment",
    "上传记录附件"
  );
  const cancelAttachmentCleanup = deferCleanup("兜底清理记录附件", () =>
    cleanupDelete(
      `${attachmentsRoot}/${encodeURIComponent(attachment.id)}?revision=${encodeURIComponent(attachment.revision)}`,
      "兜底清理记录附件"
    )
  );
  verify(
    attachment.fileSize === Buffer.byteLength(attachmentContent) &&
      attachment.mimeType === "text/plain" &&
      !/[\\/]/u.test(attachment.fileName),
    "附件文件名、大小与 MIME 元数据正确"
  );

  const attachmentList = expect(
    await request(attachmentsRoot),
    200,
    "列出记录附件"
  );
  verify(
    Array.isArray(attachmentList?.attachments) &&
      attachmentList.attachments.some(
        (item) => item.id === attachment.id && typeof item.downloadUrl === "string"
      ),
    "附件列表包含下载地址"
  );

  const downloadResult = await request(
    `${attachmentsRoot}/${encodeURIComponent(attachment.id)}`,
    { responseType: "bytes" }
  );
  const downloaded = expect(downloadResult, 200, "下载记录附件");
  verify(
    downloadResult.response.headers.get("content-type") === "text/plain" &&
      downloadResult.response.headers
        .get("content-disposition")
        ?.toLowerCase()
        .startsWith("attachment;") &&
      new TextDecoder().decode(downloaded) === attachmentContent,
    "附件下载内容与安全响应头正确"
  );

  expect(
    await request(
      `${attachmentsRoot}/${encodeURIComponent(attachment.id)}?revision=${encodeURIComponent(attachment.revision)}`,
      { method: "DELETE" }
    ),
    200,
    "删除记录附件"
  );
  cancelAttachmentCleanup();
  const attachmentsAfterDelete = expect(
    await request(attachmentsRoot),
    200,
    "删除后重新列出记录附件"
  );
  verify(
    Array.isArray(attachmentsAfterDelete?.attachments) &&
      !attachmentsAfterDelete.attachments.some(
        (item) => item.id === attachment.id
      ),
    "记录附件已从列表移除"
  );

  verify(updatedPage.revision >= 4, "页面最终 revision 正确");
  verify(record.revision >= 2, "记录最终 revision 正确");
}

async function main() {
  if (!serviceSecret) {
    const login = await request(`${baseUrl}/_wcu-api/auth/login`, {
      json: { mode: "admin", password, username },
      method: "POST"
    });
    expect(login, 200, "管理员登录");
  }

  let scenarioError = null;
  let cleanupErrors = [];
  try {
    await runScenario();
  } catch (error) {
    scenarioError = error;
  } finally {
    cleanupErrors = await runCleanupTasks();
  }

  if (scenarioError || cleanupErrors.length) {
    const messages = [];
    if (scenarioError) {
      messages.push(
        scenarioError instanceof Error ? scenarioError.message : String(scenarioError)
      );
    }
    if (cleanupErrors.length) {
      messages.push(`清理失败：\n- ${cleanupErrors.join("\n- ")}`);
    }
    throw new Error(messages.join("\n"));
  }

  console.log(
    JSON.stringify({ checks, result: "passed", total: checks.length }, null, 2)
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
