#!/usr/bin/env node

import { randomBytes, randomUUID, scryptSync } from "node:crypto";

import mysql from "mysql2/promise";

const baseUrl = new URL(process.env.BASE_URL || "http://localhost");
const timeoutMs = Math.max(
  1_000,
  Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10) || 20_000
);
const suffix = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const adminId = randomUUID();
const adminUsername = `native.admin.audit.${suffix}`;
const adminPassword = `Native-${randomBytes(18).toString("base64url")}!`;
const passwordSalt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(adminPassword, passwordSalt, 64).toString("hex");
const createdAt = new Date().toISOString();
const contentMarker = `[native-admin-${suffix}]`;
const projectTypeLabel = `原生后台验收-${suffix}`;
const updatedProjectTypeLabel = `${projectTypeLabel}-已更新`;
const checks = [];
let originalContent = null;
let contentChanged = false;
let projectTypeId = "";

function databaseValue(key, fallback) {
  return process.env[key] || fallback;
}

const pool = mysql.createPool({
  charset: "utf8mb4",
  connectionLimit: 3,
  database: databaseValue("MYSQL_DATABASE", "zhanji_universe"),
  host: databaseValue("MYSQL_HOST", "127.0.0.1"),
  password: databaseValue("MYSQL_PASSWORD", "zhanji-local-password"),
  port: Number(databaseValue("MYSQL_PORT", "3306")),
  timezone: "Z",
  user: databaseValue("MYSQL_USER", "zhanji"),
  waitForConnections: true
});

class CookieJar {
  cookies = new Map();

  capture(response) {
    const values =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean);

    for (const value of values) {
      const parts = value.split(";").map((item) => item.trim());
      const pair = parts.shift() || "";
      const separator = pair.indexOf("=");

      if (separator < 1) continue;

      const name = pair.slice(0, separator);
      const cookieValue = pair.slice(separator + 1);
      const expired = parts.some((item) => item.toLowerCase() === "max-age=0");

      if (!cookieValue || expired) this.cookies.delete(name);
      else this.cookies.set(name, cookieValue);
    }
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  has(name) {
    return this.cookies.has(name);
  }
}

const adminCookies = new CookieJar();

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(options.headers);

  headers.set("Accept", options.accept || "application/json, text/html;q=0.9");
  headers.set("User-Agent", "wcu-native-admin-linkage-smoke/1.0");

  if (options.authenticated && adminCookies.header()) {
    headers.set("Cookie", adminCookies.header());
  }

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(new URL(path, baseUrl), {
      body: options.json === undefined ? undefined : JSON.stringify(options.json),
      headers,
      method: options.method || "GET",
      redirect: "manual",
      signal: controller.signal
    });

    if (options.captureCookies) {
      adminCookies.capture(response);
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function jsonBody(response, label) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}未返回有效 JSON`);
  }
}

async function check(label, operation) {
  try {
    const detail = (await operation()) || {};
    checks.push({ detail, label, passed: true });
    console.log(`PASS ${label}`);
    return true;
  } catch (error) {
    checks.push({
      error: error instanceof Error ? error.message : String(error),
      label,
      passed: false
    });
    console.error(
      `FAIL ${label} (${error instanceof Error ? error.message : String(error)})`
    );
    return false;
  }
}

async function seedAdmin() {
  await pool.execute(
    `INSERT INTO admin_users (
      id, username, display_name, role, permissions_json, password_hash,
      password_salt, active, last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'owner', '[]', ?, ?, 1, NULL, ?, ?)`,
    [
      adminId,
      adminUsername,
      "原生后台自动验收管理员",
      passwordHash,
      passwordSalt,
      createdAt,
      createdAt
    ]
  );
}

async function restoreContent() {
  if (!originalContent || !contentChanged || !adminCookies.has("wcu_admin")) {
    return;
  }

  const response = await request("/_wcu-api/admin/content", {
    authenticated: true,
    json: originalContent,
    method: "PUT"
  });
  requireCondition(response.status === 200, `官网内容恢复失败 HTTP ${response.status}`);
  const body = await jsonBody(response, "官网内容恢复");
  requireCondition(
    body?.data?.brand?.tagline === originalContent.brand.tagline,
    "官网内容恢复校验失败"
  );
  contentChanged = false;
}

async function removeProjectType() {
  if (!projectTypeId) return;

  if (adminCookies.has("wcu_admin")) {
    const response = await request("/_wcu-api/admin/project-types", {
      authenticated: true,
      json: { id: projectTypeId },
      method: "DELETE"
    });

    if (response.status === 200 || response.status === 404) {
      projectTypeId = "";
      return;
    }
  }

  await pool.execute("DELETE FROM project_types WHERE id = ?", [projectTypeId]);
  projectTypeId = "";
}

async function cleanup() {
  const errors = [];
  const attempt = async (label, operation) => {
    try {
      await operation();
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  await attempt("恢复官网内容", restoreContent);
  await attempt("删除项目类型", removeProjectType);

  if (adminCookies.has("wcu_admin")) {
    await attempt("退出原生后台", async () => {
      const response = await request("/_wcu-api/admin/logout", {
        authenticated: true,
        captureCookies: true,
        method: "POST"
      });
      requireCondition(response.status === 200, `后台退出失败 HTTP ${response.status}`);
    });
  }

  await attempt("删除后台审计日志", () =>
    pool.execute(
      "DELETE FROM admin_audit_logs WHERE admin_user_id = ? OR actor_username = ? OR target_id = ?",
      [adminId, adminUsername, adminId]
    )
  );
  await attempt("删除一次性管理员", () =>
    pool.execute("DELETE FROM admin_users WHERE id = ? OR username = ?", [
      adminId,
      adminUsername
    ])
  );
  await attempt("验收数据零残留校验", async () => {
    const [rows] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM admin_users WHERE id = ? OR username = ?) AS admin_users,
        (SELECT COUNT(*) FROM admin_audit_logs WHERE admin_user_id = ? OR actor_username = ?) AS audit_logs,
        (SELECT COUNT(*) FROM project_types WHERE label IN (?, ?)) AS project_types`,
      [
        adminId,
        adminUsername,
        adminId,
        adminUsername,
        projectTypeLabel,
        updatedProjectTypeLabel
      ]
    );
    const residual = rows[0] || {};
    requireCondition(
      Number(residual.admin_users || 0) === 0 &&
        Number(residual.audit_logs || 0) === 0 &&
        Number(residual.project_types || 0) === 0,
      `验收数据存在残留：${JSON.stringify(residual)}`
    );
  });
  await attempt("关闭数据库连接", () => pool.end());

  if (errors.length) {
    throw new Error(errors.join("；"));
  }
}

async function main() {
  await seedAdmin();

  await check("原生 /admin 入口可用且不加载官网壳层", async () => {
    const response = await request("/admin", { accept: "text/html" });
    const html = await response.text();
    requireCondition(response.status === 200, `HTTP ${response.status}`);
    requireCondition(!html.includes("JeecgBoot"), "仍返回 Jeecg 后台");
    requireCondition(!html.includes('data-site-shell="header"'), "后台重复加载官网头部");
    return { status: response.status };
  });

  await check("匿名请求无法读取后台内容", async () => {
    const response = await request("/_wcu-api/admin/content");
    requireCondition(response.status === 401, `HTTP ${response.status}`);
  });

  await check("匿名管理员会话为未登录", async () => {
    const response = await request("/_wcu-api/admin/me");
    const body = await jsonBody(response, "匿名 me");
    requireCondition(response.status === 200 && body?.authenticated === false, "匿名状态错误");
  });

  await check("原生后台拒绝错误密码", async () => {
    const response = await request("/_wcu-api/admin/login", {
      json: { password: `wrong-${adminPassword}`, username: adminUsername },
      method: "POST"
    });
    requireCondition(response.status === 401, `HTTP ${response.status}`);
  });

  const loggedIn = await check("原生后台登录建立独立管理员会话", async () => {
    const response = await request("/_wcu-api/admin/login", {
      captureCookies: true,
      json: { password: adminPassword, username: adminUsername },
      method: "POST"
    });
    const body = await jsonBody(response, "管理员登录");
    requireCondition(response.status === 200 && body?.ok === true, `HTTP ${response.status}`);
    requireCondition(adminCookies.has("wcu_admin"), "未建立 wcu_admin 会话");
    requireCondition(
      !adminCookies.has("wcu_platform_session"),
      "管理员后台不应覆盖普通用户平台会话"
    );
  });

  await check("已登录会话识别为 owner", async () => {
    requireCondition(loggedIn, "登录前置失败");
    const response = await request("/_wcu-api/admin/me", { authenticated: true });
    const body = await jsonBody(response, "已登录 me");
    requireCondition(
      response.status === 200 && body?.authenticated === true && body?.user?.role === "owner",
      "会话身份不正确"
    );
  });

  await check("后台读取完整官网内容", async () => {
    requireCondition(loggedIn, "登录前置失败");
    const response = await request("/_wcu-api/admin/content", { authenticated: true });
    originalContent = await jsonBody(response, "后台官网内容");
    requireCondition(
      response.status === 200 && originalContent?.brand && Array.isArray(originalContent?.works),
      "官网内容结构错误"
    );
  });

  await check("后台修改会实时同步平台 API 与官网首页", async () => {
    requireCondition(originalContent, "官网内容前置失败");
    const changed = structuredClone(originalContent);
    changed.brand.tagline = `${String(originalContent.brand.tagline).slice(0, 430)} ${contentMarker}`;
    const saveResponse = await request("/_wcu-api/admin/content", {
      authenticated: true,
      json: changed,
      method: "PUT"
    });
    const saveBody = await jsonBody(saveResponse, "后台官网修改");
    requireCondition(saveResponse.status === 200 && saveBody?.ok === true, `HTTP ${saveResponse.status}`);
    contentChanged = true;

    const platformResponse = await request("/platform-api/v1/site-content");
    const platformBody = await jsonBody(platformResponse, "平台官网内容");
    requireCondition(
      platformResponse.status === 200 && platformBody?.data?.brand?.tagline?.includes(contentMarker),
      "平台 API 未读到后台修改"
    );

    const homeResponse = await request("/", { accept: "text/html" });
    const homeHtml = await homeResponse.text();
    requireCondition(homeResponse.status === 200 && homeHtml.includes(contentMarker), "首页未读到后台修改");

    await restoreContent();
  });

  const created = await check("原生后台创建项目类型并同步前台", async () => {
    requireCondition(loggedIn, "登录前置失败");
    const response = await request("/_wcu-api/admin/project-types", {
      authenticated: true,
      json: {
        active: true,
        category: "原生后台自动验收",
        description: "用于验证原生后台和前台使用同一项目类型数据源。",
        label: projectTypeLabel,
        sortOrder: 98_765
      },
      method: "POST"
    });
    const body = await jsonBody(response, "创建项目类型");
    requireCondition(response.status === 200 && body?.ok === true && body?.type?.id, `HTTP ${response.status}`);
    projectTypeId = body.type.id;

    const publicResponse = await request("/_wcu-api/project-types");
    const publicBody = await jsonBody(publicResponse, "前台项目类型");
    requireCondition(
      publicBody?.types?.some((item) => item.id === projectTypeId && item.label === projectTypeLabel),
      "前台未读到新建项目类型"
    );
  });

  await check("原生后台更新项目类型并同步前台", async () => {
    requireCondition(created && projectTypeId, "创建项目类型前置失败");
    const response = await request("/_wcu-api/admin/project-types", {
      authenticated: true,
      json: {
        active: true,
        category: "原生后台自动验收",
        description: "更新后的原生后台验收类型。",
        id: projectTypeId,
        label: updatedProjectTypeLabel,
        sortOrder: 98_765
      },
      method: "POST"
    });
    const body = await jsonBody(response, "更新项目类型");
    requireCondition(response.status === 200 && body?.type?.label === updatedProjectTypeLabel, `HTTP ${response.status}`);

    const platformResponse = await request("/platform-api/v1/project-types?active=1");
    const platformBody = await jsonBody(platformResponse, "平台项目类型");
    requireCondition(
      platformBody?.data?.some(
        (item) => item.id === projectTypeId && item.label === updatedProjectTypeLabel
      ),
      "平台 API 未读到项目类型更新"
    );
  });

  await check("原生后台删除项目类型并同步前台", async () => {
    requireCondition(projectTypeId, "项目类型前置失败");
    const deletedId = projectTypeId;
    const response = await request("/_wcu-api/admin/project-types", {
      authenticated: true,
      json: { id: deletedId },
      method: "DELETE"
    });
    const body = await jsonBody(response, "删除项目类型");
    requireCondition(response.status === 200 && body?.ok === true, `HTTP ${response.status}`);
    projectTypeId = "";

    const publicResponse = await request("/_wcu-api/project-types");
    const publicBody = await jsonBody(publicResponse, "删除后前台项目类型");
    requireCondition(
      !publicBody?.types?.some((item) => item.id === deletedId),
      "前台仍返回已删除项目类型"
    );
  });

  await check("后台 CRUD 全程写入安全审计日志", async () => {
    const response = await request(
      `/_wcu-api/admin/audit?actor=${encodeURIComponent(adminUsername)}&limit=100`,
      { authenticated: true }
    );
    const body = await jsonBody(response, "后台审计日志");
    const actions = new Set(body?.logs?.map((item) => item.action));
    for (const action of [
      "admin.login",
      "content.update",
      "project_type.create",
      "project_type.update",
      "project_type.delete"
    ]) {
      requireCondition(actions.has(action), `审计日志缺少 ${action}`);
    }
  });
}

let cleanupError = null;

try {
  await main();
} catch (error) {
  checks.push({
    error: error instanceof Error ? error.message : String(error),
    label: "原生后台联动审计运行器",
    passed: false
  });
} finally {
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : String(error);
    checks.push({ error: cleanupError, label: "验收数据零残留清理", passed: false });
  }
}

const failures = checks.filter((item) => !item.passed);

if (failures.length) {
  console.error(`NATIVE_ADMIN_LINKAGE_FAILED ${checks.length - failures.length}/${checks.length}`);
  process.exitCode = 1;
} else {
  console.log(`NATIVE_ADMIN_LINKAGE_OK ${checks.length}/${checks.length}`);
}
