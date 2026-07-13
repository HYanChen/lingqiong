#!/usr/bin/env node

import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import mysql from "mysql2/promise";

const DEFAULT_BASE_URL = "http://127.0.0.1";
const DEFAULT_TIMEOUT_MS = 20_000;

const publicPages = [
  "/universe",
  "/works",
  "/workflow",
  "/services",
  "/about",
  "/login",
  "/register",
  "/wechat-login"
];

const protectedPages = [
  "/account",
  "/account/billing",
  "/create",
  "/knowledge",
  "/projects",
  "/skills",
  "/api"
];

const authenticatedPages = ["/account", "/account/billing"];

const compatibilityRedirects = [
  ["/canvas", "/projects"]
];

function readLocalEnvValue(key) {
  const mode = process.env.NODE_ENV || "development";
  const candidates = [
    `.env.${mode}.local`,
    ".env.local",
    `.env.${mode}`,
    ".env",
    ".env.new-api.example"
  ];

  for (const file of candidates) {
    if (!existsSync(file)) {
      continue;
    }

    const lines = readFileSync(file, "utf8").split(/\r?\n/u);

    for (const line of lines) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);

      if (!match || match[1] !== key) {
        continue;
      }

      const rawValue = match[2].trim();
      const quote = rawValue[0];

      if ((quote === '"' || quote === "'") && rawValue.endsWith(quote)) {
        return rawValue.slice(1, -1);
      }

      return rawValue.replace(/\s+#.*$/u, "").trim();
    }
  }

  return undefined;
}

function normalizeBaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("BASE_URL 必须是有效的 http(s) 地址");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("BASE_URL 只支持 http(s) 协议");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/u, "") || "/";

  return url;
}

function timeoutValue() {
  const parsed = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "", 10);

  return Number.isFinite(parsed) && parsed >= 1_000 ? parsed : DEFAULT_TIMEOUT_MS;
}

class CookieJar {
  #cookies = new Map();

  capture(response) {
    const values =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : splitSetCookieHeader(response.headers.get("set-cookie"));

    for (const value of values) {
      const pair = value.split(";", 1)[0];
      const separator = pair.indexOf("=");

      if (separator <= 0) {
        continue;
      }

      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();

      if (!cookieValue) {
        this.#cookies.delete(name);
      } else {
        this.#cookies.set(name, cookieValue);
      }
    }
  }

  header() {
    return [...this.#cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get size() {
    return this.#cookies.size;
  }
}

function splitSetCookieHeader(value) {
  if (!value) {
    return [];
  }

  return value.split(/,(?=\s*[^;,\s=]+=[^;,]*)/u);
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)])
    );
  }

  return value;
}

function fingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(sortJson(value)))
    .digest("hex");
}

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function requireStatus(response, expected, label) {
  const accepted = Array.isArray(expected) ? expected : [expected];

  requireCondition(
    accepted.includes(response.status),
    `${label}状态码为 ${response.status}`
  );
}

function requireLoginRedirect(response, requestedPath) {
  requireCondition(
    response.status >= 300 && response.status < 400,
    `${requestedPath} 未登录时没有跳转`
  );

  const location = response.headers.get("location");
  requireCondition(Boolean(location), `${requestedPath} 缺少跳转地址`);

  const destination = new URL(location, baseUrl);
  requireCondition(destination.pathname === "/login", `${requestedPath} 未跳转到登录页`);
  requireCondition(
    destination.searchParams.get("next") === requestedPath,
    `${requestedPath} 未保留登录后返回地址`
  );
}

async function jsonBody(response, label) {
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}未返回有效 JSON`);
  }
}

const baseUrl = normalizeBaseUrl(process.env.BASE_URL || DEFAULT_BASE_URL);
const requestTimeoutMs = timeoutValue();
const explicitAdminUsername = process.env.SMOKE_ADMIN_USERNAME?.trim() || "";
const explicitAdminPassword = process.env.SMOKE_ADMIN_PASSWORD || "";
const legacyAdminSmoke = process.env.SMOKE_LEGACY_ADMIN === "1";
const hasExplicitUsername = explicitAdminUsername.length > 0;
const hasExplicitPassword = explicitAdminPassword.length > 0;
const credentialConfigurationError = legacyAdminSmoke &&
  hasExplicitUsername !== hasExplicitPassword
    ? "SMOKE_ADMIN_USERNAME 与 SMOKE_ADMIN_PASSWORD 必须同时提供"
    : "";
const useTemporaryAdmin =
  legacyAdminSmoke && !hasExplicitUsername && !hasExplicitPassword;
const temporarySuffix = `${Date.now().toString(36)}.${randomBytes(4).toString("hex")}`;
const temporaryAdminId = randomUUID();
const temporaryAdminUsername = `http.audit.${temporarySuffix}`;
const temporaryAdminPassword = `Http-${randomBytes(18).toString("base64url")}!`;
const temporaryAdminOidcSubject = `admin:owner:${temporaryAdminId}`;
const temporaryAdminCreatedAt = new Date().toISOString();
const temporaryAdminSalt = randomBytes(16).toString("hex");
const temporaryAdminPasswordHash = scryptSync(
  temporaryAdminPassword,
  temporaryAdminSalt,
  64
).toString("hex");
const adminUsername = useTemporaryAdmin
  ? temporaryAdminUsername
  : explicitAdminUsername;
const adminPassword = useTemporaryAdmin
  ? temporaryAdminPassword
  : explicitAdminPassword;
const results = [];
const adminCookies = new CookieJar();
let mainPool = null;

function databaseValue(key, fallback) {
  return process.env[key] || readLocalEnvValue(key) || fallback;
}

function getMainPool() {
  mainPool ??= mysql.createPool({
    bigNumberStrings: true,
    charset: "utf8mb4",
    connectionLimit: 3,
    database: databaseValue("MYSQL_DATABASE", "zhanji_universe"),
    host: databaseValue("MYSQL_HOST", "127.0.0.1"),
    password: databaseValue("MYSQL_PASSWORD", "zhanji-local-password"),
    port: Number(databaseValue("MYSQL_PORT", "3306")),
    supportBigNumbers: true,
    timezone: "Z",
    user: databaseValue("MYSQL_USER", "zhanji"),
    waitForConnections: true
  });

  return mainPool;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = new Headers(options.headers);

  headers.set("Accept", options.accept || "application/json, text/html;q=0.9");
  headers.set("User-Agent", "wcu-http-smoke-audit/1.0");

  if (options.authenticated && adminCookies.size > 0) {
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
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("请求超时");
    }

    throw new Error("请求失败或服务不可达");
  } finally {
    clearTimeout(timer);
  }
}

async function first(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] ?? null;
}

async function createTemporaryAdmin() {
  const pool = getMainPool();

  await pool.execute(
    `INSERT INTO admin_users (
      id, username, display_name, role, permissions_json, password_hash,
      password_salt, active, last_login_at, created_at, updated_at
     ) VALUES (?, ?, ?, 'owner', '[]', ?, ?, 1, NULL, ?, ?)`,
    [
      temporaryAdminId,
      temporaryAdminUsername,
      "HTTP 自动审计所有者",
      temporaryAdminPasswordHash,
      temporaryAdminSalt,
      temporaryAdminCreatedAt,
      temporaryAdminCreatedAt
    ]
  );

  const created = await first(
    pool,
    "SELECT id, role, active FROM admin_users WHERE id = ? AND username = ?",
    [temporaryAdminId, temporaryAdminUsername]
  );
  requireCondition(
    created?.id === temporaryAdminId &&
      created?.role === "owner" &&
      Number(created?.active) === 1,
    "一次性所有者创建后校验失败"
  );
}

async function cleanupTemporaryAdmin() {
  const errors = [];
  const staleCookie = adminCookies.header();
  const attempt = async (label, operation) => {
    try {
      await operation();
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  if (staleCookie) {
    await attempt("正式退出", async () => {
      const response = await request("/_wcu-api/auth/logout", {
        authenticated: true,
        captureCookies: true,
        method: "POST"
      });
      requireStatus(response, 200, "一次性管理员退出");
      const body = await jsonBody(response, "一次性管理员退出");
      requireCondition(body?.ok === true, "一次性管理员退出结果不正确");
    });
  }

  const pool = getMainPool();

  await attempt("计费审计清理", () =>
    pool.execute(
      "DELETE FROM model_billing_audits WHERE principal_id = ?",
      [temporaryAdminId]
    )
  );
  await attempt("账户绑定清理", () =>
    pool.execute(
      "DELETE FROM api_account_links WHERE principal_id = ? OR oidc_subject = ?",
      [temporaryAdminId, temporaryAdminOidcSubject]
    )
  );
  await attempt("模型调用清理", () =>
    pool.execute("DELETE FROM model_api_calls WHERE actor_id = ?", [
      temporaryAdminId
    ])
  );
  await attempt("管理员审计清理", () =>
    pool.execute(
      "DELETE FROM admin_audit_logs WHERE admin_user_id = ? OR actor_username = ? OR target_id = ?",
      [temporaryAdminId, temporaryAdminUsername, temporaryAdminId]
    )
  );
  await attempt("一次性管理员清理", () =>
    pool.execute("DELETE FROM admin_users WHERE id = ? OR username = ?", [
      temporaryAdminId,
      temporaryAdminUsername
    ])
  );

  let residual = null;
  await attempt("零残留校验", async () => {
    residual = {
      adminAudit: Number(
        (
          await first(
            pool,
            "SELECT COUNT(*) AS total FROM admin_audit_logs WHERE admin_user_id = ? OR actor_username = ? OR target_id = ?",
            [temporaryAdminId, temporaryAdminUsername, temporaryAdminId]
          )
        )?.total ?? 0
      ),
      adminUser: Number(
        (
          await first(
            pool,
            "SELECT COUNT(*) AS total FROM admin_users WHERE id = ? OR username = ?",
            [temporaryAdminId, temporaryAdminUsername]
          )
        )?.total ?? 0
      ),
      apiAccountLink: Number(
        (
          await first(
            pool,
            "SELECT COUNT(*) AS total FROM api_account_links WHERE principal_id = ? OR oidc_subject = ?",
            [temporaryAdminId, temporaryAdminOidcSubject]
          )
        )?.total ?? 0
      ),
      billingAudit: Number(
        (
          await first(
            pool,
            "SELECT COUNT(*) AS total FROM model_billing_audits WHERE principal_id = ?",
            [temporaryAdminId]
          )
        )?.total ?? 0
      ),
      modelCalls: Number(
        (
          await first(
            pool,
            "SELECT COUNT(*) AS total FROM model_api_calls WHERE actor_id = ?",
            [temporaryAdminId]
          )
        )?.total ?? 0
      )
    };
    requireCondition(
      Object.values(residual).every((value) => value === 0),
      `一次性管理员清理存在残留：${JSON.stringify(residual)}`
    );
  });

  let sessionInvalidated = !staleCookie;
  if (staleCookie) {
    await attempt("旧会话失效校验", async () => {
      const response = await request("/_wcu-api/admin/me", {
        headers: { Cookie: staleCookie }
      });
      requireStatus(response, 200, "旧会话失效校验");
      const body = await jsonBody(response, "旧会话失效校验");
      requireCondition(body?.authenticated === false, "旧管理员会话仍然有效");
      sessionInvalidated = true;
    });
  }

  if (errors.length) {
    throw new Error(errors.join("；"));
  }

  return {
    residual,
    sessionInvalidated,
    temporaryAdmin: true
  };
}

async function check(group, name, operation) {
  const startedAt = Date.now();

  try {
    const detail = (await operation()) || {};
    results.push({
      detail,
      durationMs: Date.now() - startedAt,
      group,
      name,
      status: "passed"
    });
    return true;
  } catch (error) {
    results.push({
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "未知错误",
      group,
      name,
      status: "failed"
    });
    return false;
  }
}

function printSummary(startedAt) {
  const passed = results.filter((item) => item.status === "passed").length;
  const failed = results.length - passed;
  const groups = Object.fromEntries(
    [...new Set(results.map((item) => item.group))].map((group) => {
      const items = results.filter((item) => item.group === group);

      return [
        group,
        {
          failed: items.filter((item) => item.status === "failed").length,
          passed: items.filter((item) => item.status === "passed").length,
          total: items.length
        }
      ];
    })
  );

  const report = {
    baseUrl: baseUrl.origin + (baseUrl.pathname === "/" ? "" : baseUrl.pathname),
    credentialMode: legacyAdminSmoke
      ? useTemporaryAdmin
        ? "temporary-owner"
        : "external"
      : "jeecg-service",
    durationMs: Date.now() - startedAt,
    finishedAt: new Date().toISOString(),
    groups,
    result: failed === 0 ? "passed" : "failed",
    startedAt: new Date(startedAt).toISOString(),
    tests: results,
    totals: { failed, passed, total: results.length }
  };

  console.log(JSON.stringify(report, null, 2));
  process.exitCode = failed === 0 ? 0 : 1;
}

async function main() {
  let siteContent;

  const reachable = await check("public-pages", "公开首页 /", async () => {
    const response = await request("/", { accept: "text/html" });
    requireStatus(response, 200, "公开首页");
    return { httpStatus: response.status };
  });

  if (!reachable) {
    return;
  }

  for (const path of publicPages) {
    await check("public-pages", `公开页 ${path}`, async () => {
      const response = await request(path, { accept: "text/html" });
      requireStatus(response, 200, `公开页 ${path}`);
      return { httpStatus: response.status };
    });
  }

  await check("admin-entry", "Jeecg 后台登录入口 /admin/", async () => {
    const response = await request("/admin/", { accept: "text/html" });
    requireStatus(response, 200, "Jeecg 后台登录入口");
    return { architecture: "jeecg", httpStatus: response.status };
  });

  for (const path of protectedPages) {
    await check("access-control", `未登录保护 ${path}`, async () => {
      const response = await request(path, { accept: "text/html" });
      requireLoginRedirect(response, path);
      return { httpStatus: response.status, redirect: "/login" };
    });
  }

  for (const [path, destinationPath] of compatibilityRedirects) {
    await check("routing", `兼容入口 ${path} 跳转 ${destinationPath}`, async () => {
      const response = await request(path, { accept: "text/html" });
      requireStatus(response, [307, 308], `兼容入口 ${path}`);

      const location = response.headers.get("location");
      requireCondition(Boolean(location), `${path} 缺少跳转地址`);
      const destination = new URL(location, baseUrl);
      requireCondition(
        destination.pathname === destinationPath,
        `${path} 未跳转到 ${destinationPath}`
      );

      return { httpStatus: response.status, redirect: destinationPath };
    });
  }

  if (legacyAdminSmoke) {
  await check("access-control", "未登录不可读取后台内容", async () => {
    const response = await request("/_wcu-api/admin/content");
    requireStatus(response, 401, "后台内容权限");
    return { httpStatus: response.status };
  });

  await check("admin-auth", "未登录 me", async () => {
    const response = await request("/_wcu-api/admin/me");
    requireStatus(response, 200, "未登录 me");
    const body = await jsonBody(response, "未登录 me");
    requireCondition(body?.authenticated === false, "未登录 me 状态不正确");
    return { authenticated: false, httpStatus: response.status };
  });

  await check("admin-auth", "管理员错误密码", async () => {
    const response = await request("/_wcu-api/auth/login", {
      json: {
        mode: "admin",
        password: `invalid-${randomUUID()}`,
        username: adminUsername
      },
      method: "POST"
    });
    requireStatus(response, 401, "错误密码登录");
    return { httpStatus: response.status };
  });

  const loggedIn = await check("admin-auth", "管理员正确登录", async () => {
    const response = await request("/_wcu-api/auth/login", {
      captureCookies: true,
      json: { mode: "admin", password: adminPassword, username: adminUsername },
      method: "POST"
    });
    requireStatus(response, 200, "管理员登录");
    const body = await jsonBody(response, "管理员登录");
    requireCondition(body?.ok === true, "管理员登录结果不正确");
    requireCondition(adminCookies.size > 0, "管理员登录未建立会话");
    return { authenticated: true, httpStatus: response.status };
  });

  await check("admin-auth", "已登录 me", async () => {
    requireCondition(loggedIn, "正确登录前置检查未通过");
    const response = await request("/_wcu-api/admin/me", { authenticated: true });
    requireStatus(response, 200, "已登录 me");
    const body = await jsonBody(response, "已登录 me");
    requireCondition(body?.authenticated === true, "已登录 me 未识别会话");
    requireCondition(
      ["admin", "owner"].includes(body?.user?.role),
      "已登录 me 角色不正确"
    );
    return {
      authenticated: true,
      httpStatus: response.status,
      role: body.user.role
    };
  });

  for (const path of authenticatedPages) {
    await check("access-control", `已登录可访问 ${path}`, async () => {
      requireCondition(loggedIn, "正确登录前置检查未通过");
      const response = await request(path, {
        accept: "text/html",
        authenticated: true
      });
      requireStatus(response, 200, `已登录页面 ${path}`);
      return { httpStatus: response.status };
    });
  }

  await check("admin-auth", "管理员审计日志读取", async () => {
    requireCondition(loggedIn, "正确登录前置检查未通过");
    const response = await request("/_wcu-api/admin/audit?limit=25&offset=0", {
      authenticated: true
    });
    requireStatus(response, 200, "管理员审计日志");
    const body = await jsonBody(response, "管理员审计日志");
    requireCondition(
      body?.ok === true && Array.isArray(body?.logs) && Number.isFinite(body?.total),
      "管理员审计日志结构不正确"
    );
    return {
      httpStatus: response.status,
      returned: body.logs.length,
      total: body.total
    };
  });

  const contentLoaded = await check("site-content", "官网内容 GET", async () => {
    requireCondition(loggedIn, "正确登录前置检查未通过");
    const response = await request("/_wcu-api/admin/content", { authenticated: true });
    requireStatus(response, 200, "官网内容 GET");
    siteContent = await jsonBody(response, "官网内容 GET");
    requireCondition(siteContent?.brand && Array.isArray(siteContent?.works), "官网内容结构不正确");
    requireCondition(Array.isArray(siteContent?.teamMembers), "团队内容结构不正确");
    return {
      httpStatus: response.status,
      teamMemberCount: siteContent.teamMembers.length,
      workCount: siteContent.works.length
    };
  });

  if (contentLoaded) {
    for (const [index, work] of siteContent.works.entries()) {
      await check("public-pages", `作品详情 ${index + 1}/${siteContent.works.length}`, async () => {
        requireCondition(typeof work?.slug === "string" && work.slug.length > 0, "作品详情地址缺失");
        const response = await request(`/works/${encodeURIComponent(work.slug)}`, {
          accept: "text/html"
        });
        requireStatus(response, 200, "作品详情");
        return { httpStatus: response.status };
      });
    }

    for (const [index, member] of siteContent.teamMembers.entries()) {
      await check("public-pages", `人物详情 ${index + 1}/${siteContent.teamMembers.length}`, async () => {
        requireCondition(typeof member?.slug === "string" && member.slug.length > 0, "人物详情地址缺失");
        const response = await request(`/about/team/${encodeURIComponent(member.slug)}`, {
          accept: "text/html"
        });
        requireStatus(response, 200, "人物详情");
        return { httpStatus: response.status };
      });
    }
  }

  await check("site-content", "官网内容 PUT 原样回写与恢复", async () => {
    requireCondition(contentLoaded && siteContent, "官网内容 GET 前置检查未通过");
    const baseline = fingerprint(siteContent);
    let response;

    try {
      response = await request("/_wcu-api/admin/content", {
        authenticated: true,
        json: siteContent,
        method: "PUT"
      });
      requireStatus(response, 200, "官网内容 PUT");
      const body = await jsonBody(response, "官网内容 PUT");
      requireCondition(body?.ok === true, "官网内容 PUT 结果不正确");

      const verifyResponse = await request("/_wcu-api/admin/content", {
        authenticated: true
      });
      requireStatus(verifyResponse, 200, "官网内容回写验证");
      const verifiedContent = await jsonBody(verifyResponse, "官网内容回写验证");
      requireCondition(fingerprint(verifiedContent) === baseline, "原样回写后的内容不一致");
    } finally {
      const restoreResponse = await request("/_wcu-api/admin/content", {
        authenticated: true,
        json: siteContent,
        method: "PUT"
      });
      requireStatus(restoreResponse, 200, "官网内容恢复");
      const restoreBody = await jsonBody(restoreResponse, "官网内容恢复");
      requireCondition(restoreBody?.ok === true, "官网内容恢复失败");

      const restoreVerifyResponse = await request("/_wcu-api/admin/content", {
        authenticated: true
      });
      requireStatus(restoreVerifyResponse, 200, "官网内容恢复验证");
      const restoredContent = await jsonBody(
        restoreVerifyResponse,
        "官网内容恢复验证"
      );
      requireCondition(fingerprint(restoredContent) === baseline, "官网内容恢复校验失败");
    }

    return { httpStatus: response.status, restored: true };
  });
  }

  await check("project-types", "公开项目类型读取", async () => {
    const response = await request("/_wcu-api/project-types");
    requireStatus(response, 200, "公开项目类型");
    const body = await jsonBody(response, "公开项目类型");
    requireCondition(body?.ok === true && Array.isArray(body?.types), "公开项目类型结构不正确");
    return { count: body.types.length, httpStatus: response.status };
  });

  if (legacyAdminSmoke) {
  await check("project-types", "旧后台项目类型读取", async () => {
    requireCondition(loggedIn, "正确登录前置检查未通过");
    const response = await request("/_wcu-api/admin/project-types", {
      authenticated: true
    });
    requireStatus(response, 200, "后台项目类型");
    const body = await jsonBody(response, "后台项目类型");
    requireCondition(body?.ok === true && Array.isArray(body?.types), "后台项目类型结构不正确");
    return { count: body.types.length, httpStatus: response.status };
  });
  }

  await check("platform-api", "独立 API 健康检查", async () => {
    const response = await request("/platform-api/v1/health");
    requireStatus(response, 200, "独立 API 健康检查");
    const body = await jsonBody(response, "独立 API 健康检查");
    requireCondition(body?.ok === true && body?.meta?.version === "v1", "独立 API 响应结构不正确");
    return { httpStatus: response.status, version: body.meta.version };
  });

  await check("platform-api", "独立 API 官网内容", async () => {
    const response = await request("/platform-api/v1/site-content");
    requireStatus(response, 200, "独立 API 官网内容");
    const body = await jsonBody(response, "独立 API 官网内容");
    requireCondition(body?.ok === true && body?.data?.brand, "独立 API 官网内容结构不正确");
    return { httpStatus: response.status };
  });

  await check("platform-api", "独立 API 项目类型", async () => {
    const response = await request("/platform-api/v1/project-types?active=1");
    requireStatus(response, 200, "独立 API 项目类型");
    const body = await jsonBody(response, "独立 API 项目类型");
    requireCondition(body?.ok === true && Array.isArray(body?.data), "独立 API 项目类型结构不正确");
    return { count: body.data.length, httpStatus: response.status };
  });

  await check("routing", "未知路由 404", async () => {
    const response = await request(`/__smoke-missing-${randomUUID()}`, {
      accept: "text/html"
    });
    requireStatus(response, 404, "未知路由");
    return { httpStatus: response.status };
  });

}

async function run() {
  const startedAt = Date.now();

  try {
    if (credentialConfigurationError) {
      throw new Error(credentialConfigurationError);
    }

    if (useTemporaryAdmin) {
      await createTemporaryAdmin();
    }

    await main();
  } catch (error) {
    results.push({
      error: error instanceof Error ? error.message : "未知错误",
      group: "runner",
      name: "审计运行器",
      status: "failed"
    });
  } finally {
    if (useTemporaryAdmin) {
      await check("cleanup", "一次性管理员与会话零残留", cleanupTemporaryAdmin);
    }

    if (mainPool) {
      try {
        await mainPool.end();
      } catch (error) {
        results.push({
          error: error instanceof Error ? error.message : "未知错误",
          group: "cleanup",
          name: "数据库连接关闭",
          status: "failed"
        });
      }
    }
  }

  printSummary(startedAt);
}

run().catch((error) => {
  results.push({
    error: error instanceof Error ? error.message : "未知错误",
    group: "runner",
    name: "审计运行器最终处理",
    status: "failed"
  });
  printSummary(Date.now());
});
