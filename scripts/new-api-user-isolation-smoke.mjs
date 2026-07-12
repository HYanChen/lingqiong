#!/usr/bin/env node

import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import mysql from "mysql2/promise";

const baseUrl = new URL(process.env.BASE_URL || "http://localhost");
const envFiles = [".env.local", ".env", ".env.new-api.example"];
const suffix = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const frontUserId = randomUUID();
const frontUsername = `api.user.audit.${suffix}`;
const frontPassword = `Front-${randomBytes(18).toString("base64url")}!`;
const oidcSubject = `creator:${frontUserId}`;
const createdAt = new Date().toISOString();
const checks = [];
let newApiUserId = 0;

function envValue(key) {
  if (process.env[key]) return process.env[key];

  for (const file of envFiles) {
    if (!existsSync(file)) continue;

    const match = readFileSync(file, "utf8")
      .split(/\r?\n/u)
      .map((line) =>
        line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u)
      )
      .find((item) => item?.[1] === key);

    if (match?.[2]) {
      return match[2].trim().replace(/^(['"])(.*)\1$/u, "$2");
    }
  }

  return undefined;
}

function databaseConfig(database) {
  return {
    bigNumberStrings: true,
    charset: "utf8mb4",
    connectionLimit: 3,
    database,
    host: envValue("MYSQL_HOST") || "127.0.0.1",
    password: envValue("MYSQL_PASSWORD") || "zhanji-local-password",
    port: Number(envValue("MYSQL_PORT") || 3306),
    supportBigNumbers: true,
    timezone: "Z",
    user: envValue("MYSQL_USER") || "zhanji",
    waitForConnections: true
  };
}

const mainPool = mysql.createPool(
  databaseConfig(envValue("MYSQL_DATABASE") || "zhanji_universe")
);
const newApiPool = mysql.createPool(
  databaseConfig(envValue("NEW_API_MYSQL_DATABASE") || "new_api")
);

class CookieJar {
  cookies = new Map();

  capture(response) {
    const values =
      response.headers.getSetCookie?.() ??
      [response.headers.get("set-cookie")].filter(Boolean);

    for (const value of values) {
      for (const header of value.split(/,(?=\s*[^;,]+=)/u)) {
        const parts = header.split(";").map((item) => item.trim());
        const pair = parts.shift() || "";
        const separator = pair.indexOf("=");

        if (separator < 1) continue;

        const name = pair.slice(0, separator);
        const cookieValue = pair.slice(separator + 1);
        const expired = parts.some(
          (item) => item.toLowerCase() === "max-age=0"
        );

        if (!cookieValue || expired) this.cookies.delete(name);
        else this.cookies.set(name, cookieValue);
      }
    }
  }

  header() {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  has(name) {
    return this.cookies.has(name);
  }

}

const jar = new CookieJar();

function pass(condition, message, context) {
  if (!condition) {
    const detail = context ? `\n${JSON.stringify(context, null, 2)}` : "";
    throw new Error(`${message}${detail}`);
  }

  checks.push(message);
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function passwordRecord(password) {
  const salt = randomBytes(16).toString("hex");

  return {
    hash: scryptSync(password, salt, 64).toString("hex"),
    salt
  };
}

async function first(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] ?? null;
}

async function rows(pool, sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

async function request(path, { accept, headers, json, method = "GET" } = {}) {
  const url = new URL(path, baseUrl);
  const requestHeaders = new Headers(headers);
  const cookie = jar.header();

  requestHeaders.set(
    "Accept",
    accept || "application/json, text/html;q=0.9"
  );
  requestHeaders.set("User-Agent", "lingqiong-new-api-user-isolation-smoke/1.0");
  if (cookie) requestHeaders.set("Cookie", cookie);
  if (json !== undefined) requestHeaders.set("Content-Type", "application/json");

  const response = await fetch(url, {
    body: json === undefined ? undefined : JSON.stringify(json),
    headers: requestHeaders,
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000)
  });
  jar.capture(response);

  return response;
}

async function responseJson(response) {
  return response.json().catch(() => null);
}

async function seedFrontUser() {
  const password = passwordRecord(frontPassword);

  await mainPool.execute(
    `INSERT INTO front_users (
      id, username, account, contact, profile, invite_code, source,
      password_hash, password_salt, active, failed_attempts, locked_until,
      last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, 'login', ?, ?, 1, 0, NULL, NULL, ?, ?)`,
    [
      frontUserId,
      frontUsername,
      `灵穹 API 普通用户验收 ${suffix}`,
      `${frontUsername}@example.invalid`,
      "普通创作者",
      password.hash,
      password.salt,
      createdAt,
      createdAt
    ]
  );
}

async function enterNewApi() {
  const logoutResponse = await request("/api/user/logout");
  const logoutPayload = await responseJson(logoutResponse);
  pass(
    logoutResponse.status === 200 && logoutPayload?.success === true,
    "进入前会先清除遗留的灵穹 API 会话",
    { body: logoutPayload, status: logoutResponse.status }
  );
  const clearedSessionResponse = await request("/api/user/self");
  pass(
    clearedSessionResponse.status === 401 ||
      clearedSessionResponse.status === 403,
    "遗留的灵穹 API 登录身份已失效",
    { status: clearedSessionResponse.status }
  );

  const stateResponse = await request("/api/oauth/state");
  const statePayload = await responseJson(stateResponse);
  pass(
    stateResponse.status === 200 &&
      statePayload?.success === true &&
      typeof statePayload.data === "string",
    "灵穹 API OIDC state 可正常创建",
    { body: statePayload, status: stateResponse.status }
  );

  const authorizeUrl = new URL("/_wcu-api/oidc/authorize", baseUrl);
  authorizeUrl.searchParams.set(
    "client_id",
    envValue("WCU_OIDC_CLIENT_ID") || "zhanji-bookstack"
  );
  authorizeUrl.searchParams.set(
    "redirect_uri",
    new URL("/oauth/oidc", baseUrl).toString()
  );
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", statePayload.data);
  authorizeUrl.searchParams.set("return_to", "/dashboard");

  const authorizeResponse = await request(authorizeUrl);
  const callbackLocation = authorizeResponse.headers.get("location") || "";
  const callbackUrl = new URL(callbackLocation || "/", baseUrl);
  pass(
    authorizeResponse.status >= 300 &&
      authorizeResponse.status < 400 &&
      callbackUrl.origin === baseUrl.origin &&
      callbackUrl.pathname === "/oauth/oidc",
    "普通用户 OIDC 授权只回调灵穹 API 用户端",
    { location: callbackLocation, status: authorizeResponse.status }
  );

  const callbackResponse = await request(callbackUrl, { accept: "text/html" });
  pass(callbackResponse.status === 200, "灵穹 API OIDC 回调页可读取", {
    status: callbackResponse.status
  });

  const exchangeUrl = new URL("/api/oauth/oidc", baseUrl);
  exchangeUrl.searchParams.set("code", callbackUrl.searchParams.get("code") || "");
  exchangeUrl.searchParams.set("state", callbackUrl.searchParams.get("state") || "");
  const exchangeResponse = await request(exchangeUrl);
  const exchangePayload = await responseJson(exchangeResponse);
  pass(
    exchangeResponse.status === 200 &&
      exchangePayload?.success === true &&
      exchangePayload?.data?.id != null,
    "灵穹 API OIDC 凭证交换成功",
    { body: exchangePayload, status: exchangeResponse.status }
  );

  const exchangedUserId = numberValue(exchangePayload.data.id);
  const selfResponse = await request("/api/user/self", {
    headers: { "New-Api-User": String(exchangedUserId) }
  });
  const selfPayload = await responseJson(selfResponse);
  pass(
    selfResponse.status === 200 &&
      selfPayload?.success === true &&
      numberValue(selfPayload?.data?.id) === exchangedUserId,
    "灵穹 API 会话属于凭证交换返回的用户",
    { body: selfPayload, status: selfResponse.status }
  );

  return { exchangedUserId, self: selfPayload.data };
}

async function cleanup() {
  const errors = [];
  const cleanupStep = async (label, operation) => {
    try {
      await operation();
    } catch (error) {
      if (error?.code !== "ER_NO_SUCH_TABLE") {
        errors.push(`${label}: ${error instanceof Error ? error.message : error}`);
      }
    }
  };

  if (!newApiUserId) {
    await cleanupStep("发现灵穹 API 临时用户", async () => {
      const user = await first(
        newApiPool,
        "SELECT id FROM users WHERE oidc_id = ? LIMIT 1",
        [oidcSubject]
      );
      newApiUserId = numberValue(user?.id);
    });
  }

  await cleanupStep("账户关联清理", () =>
    mainPool.execute(
      "DELETE FROM api_account_links WHERE principal_id = ? OR oidc_subject = ? OR new_api_user_id = ?",
      [frontUserId, oidcSubject, newApiUserId]
    )
  );
  await cleanupStep("前台身份清理", () =>
    mainPool.execute("DELETE FROM front_user_identities WHERE user_id = ?", [
      frontUserId
    ])
  );
  await cleanupStep("前台用户清理", () =>
    mainPool.execute("DELETE FROM front_users WHERE id = ?", [frontUserId])
  );

  if (newApiUserId) {
    for (const [label, table] of [
      ["灵穹 API Token 清理", "tokens"],
      ["灵穹 API 使用日志清理", "logs"],
      ["灵穹 API 充值记录清理", "top_ups"],
      ["灵穹 API OAuth 绑定清理", "user_oauth_bindings"]
    ]) {
      await cleanupStep(label, () =>
        newApiPool.execute(`DELETE FROM ${table} WHERE user_id = ?`, [newApiUserId])
      );
    }
  }

  await cleanupStep("灵穹 API 用户清理", () =>
    newApiPool.execute("DELETE FROM users WHERE id = ? OR oidc_id = ?", [
      newApiUserId,
      oidcSubject
    ])
  );

  await mainPool.end().catch(() => undefined);
  await newApiPool.end().catch(() => undefined);

  if (errors.length) throw new Error(errors.join("; "));
}

async function main() {
  const adminRowsBefore = await rows(
    newApiPool,
    "SELECT id, role FROM users WHERE role >= 10 AND deleted_at IS NULL ORDER BY id"
  );
  const adminIdsBefore = new Set(adminRowsBefore.map((row) => numberValue(row.id)));
  pass(adminIdsBefore.size > 0, "灵穹 API 管理员基线已读取");

  await seedFrontUser();
  const loginResponse = await request("/_wcu-api/auth/login", {
    json: { password: frontPassword, username: frontUsername },
    method: "POST"
  });
  const loginPayload = await responseJson(loginResponse);
  pass(loginResponse.status === 200, "普通前台用户账号密码登录成功", {
    body: loginPayload,
    status: loginResponse.status
  });
  pass(jar.has("wcu_platform_session"), "普通前台用户平台会话已建立");
  pass(!jar.has("wcu_admin"), "普通前台用户绝不建立管理员 Cookie");
  pass(
    loginPayload?.user?.role === "creator" &&
      loginPayload?.user?.source !== "admin" &&
      loginPayload?.user?.id === frontUserId,
    "普通前台登录响应保持 creator 身份",
    { user: loginPayload?.user }
  );

  const firstEntry = await enterNewApi();
  newApiUserId = firstEntry.exchangedUserId;
  const firstRows = await rows(
    newApiPool,
    `SELECT id, username, role, status, oidc_id
     FROM users WHERE oidc_id = ? AND deleted_at IS NULL`,
    [oidcSubject]
  );
  pass(firstRows.length === 1, "首次进入只创建一个灵穹 API 用户", {
    rows: firstRows
  });
  const firstUser = firstRows[0];
  pass(numberValue(firstUser.id) === newApiUserId, "首次创建用户 ID 与登录会话一致");
  pass(numberValue(firstUser.role) === 1, "首次创建的是普通用户角色，不是管理员", {
    role: firstUser.role
  });
  pass(numberValue(firstEntry.self?.role) === 1, "灵穹 API 自身接口返回普通用户角色", {
    role: firstEntry.self?.role
  });
  pass(!adminIdsBefore.has(newApiUserId), "普通用户未复用任何灵穹 API 管理员用户 ID", {
    adminIds: [...adminIdsBefore],
    newApiUserId
  });
  pass(firstUser.oidc_id === oidcSubject, "灵穹 API 用户绑定独立 creator OIDC subject");

  const overviewResponse = await request("/_wcu-api/account/overview");
  const overviewPayload = await responseJson(overviewResponse);
  pass(
    overviewResponse.status === 200 &&
      overviewPayload?.ok === true &&
      numberValue(overviewPayload?.account?.id) === newApiUserId &&
      overviewPayload?.platformUser?.role === "creator",
    "用户中心关联同一个普通灵穹 API 账户",
    { body: overviewPayload, status: overviewResponse.status }
  );
  const link = await first(
    mainPool,
    `SELECT principal_type, principal_id, oidc_subject, new_api_user_id
     FROM api_account_links WHERE oidc_subject = ? LIMIT 1`,
    [oidcSubject]
  );
  pass(
    link?.principal_type === "creator" &&
      link?.principal_id === frontUserId &&
      link?.oidc_subject === oidcSubject &&
      numberValue(link?.new_api_user_id) === newApiUserId,
    "账户映射只关联当前 creator，不关联管理员",
    { link }
  );

  pass(jar.has("session"), "首次进入后已建立灵穹 API 用户会话");
  const secondEntry = await enterNewApi();
  pass(
    secondEntry.exchangedUserId === newApiUserId,
    "重复进入复用首次创建的同一灵穹 API 用户 ID",
    { first: newApiUserId, second: secondEntry.exchangedUserId }
  );
  const repeatedRows = await rows(
    newApiPool,
    `SELECT id, role, oidc_id
     FROM users WHERE oidc_id = ? AND deleted_at IS NULL`,
    [oidcSubject]
  );
  pass(
    repeatedRows.length === 1 &&
      numberValue(repeatedRows[0]?.id) === newApiUserId &&
      numberValue(repeatedRows[0]?.role) === 1,
    "重复 OIDC 后仍只有一个普通用户且角色未提升",
    { rows: repeatedRows }
  );

  const adminRowsAfter = await rows(
    newApiPool,
    "SELECT id, role FROM users WHERE role >= 10 AND deleted_at IS NULL ORDER BY id"
  );
  pass(
    JSON.stringify(adminRowsAfter) === JSON.stringify(adminRowsBefore),
    "普通用户两次进入未新增、替换或修改管理员账户",
    { after: adminRowsAfter, before: adminRowsBefore }
  );

  console.log(
    JSON.stringify(
      {
        checks,
        newApiUser: {
          id: newApiUserId,
          oidcSubject,
          role: numberValue(firstUser.role)
        },
        result: "passed",
        total: checks.length
      },
      null,
      2
    )
  );
}

try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        checks,
        error: error instanceof Error ? error.message : "灵穹 API 用户隔离验收失败",
        result: "failed",
        total: checks.length
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(
      JSON.stringify({
        cleanup: "failed",
        error: error instanceof Error ? error.message : "清理失败"
      })
    );
    process.exitCode = 1;
  }
}
