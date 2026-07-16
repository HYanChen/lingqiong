#!/usr/bin/env node

import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";

import mysql from "mysql2/promise";

const baseUrl = new URL(process.env.BASE_URL || "http://localhost");
const suffix = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const frontId = "system-auth-boundary-smoke";
const frontUsername = "system.auth.audit";
const frontPassword = `Front-${randomBytes(18).toString("base64url")}!`;
const adminId = randomUUID();
const adminUsername = `admin.audit.${suffix}`;
const adminPassword = `Admin-${randomBytes(18).toString("base64url")}!`;
const createdAt = new Date().toISOString();
const uploadedFiles = new Set();
const steps = [];
let originalSiteContent = null;

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
const newApiPool = mysql.createPool({
  charset: "utf8mb4",
  connectionLimit: 3,
  database: databaseValue("NEW_API_MYSQL_DATABASE", "new_api"),
  host: databaseValue("MYSQL_HOST", "127.0.0.1"),
  password: databaseValue("MYSQL_PASSWORD", "zhanji-local-password"),
  port: Number(databaseValue("MYSQL_PORT", "3306")),
  timezone: "Z",
  user: databaseValue("MYSQL_USER", "zhanji"),
  waitForConnections: true
});
let newApiUserId = 0;

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

const jar = new CookieJar();

function passwordRecord(password) {
  const salt = randomBytes(16).toString("hex");
  return {
    hash: scryptSync(password, salt, 64).toString("hex"),
    salt
  };
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(pathname, options = {}) {
  const url = new URL(pathname, baseUrl);
  const headers = new Headers(options.headers);
  const cookie = jar.header();

  headers.set("Accept", options.accept || "application/json, text/html;q=0.9");
  headers.set("User-Agent", "lingqiong-auth-boundary-smoke/1.0");
  if (cookie) headers.set("Cookie", cookie);
  if (options.json !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    body:
      options.body !== undefined
        ? options.body
        : options.form !== undefined
        ? options.form
        : options.json === undefined
          ? undefined
          : JSON.stringify(options.json),
    headers,
    method: options.method || "GET",
    redirect: "manual"
  });
  jar.capture(response);
  steps.push({ path: url.pathname, status: response.status });
  return response;
}

async function json(response) {
  return response.json().catch(() => null);
}

async function seedAccounts() {
  const front = passwordRecord(frontPassword);
  const admin = passwordRecord(adminPassword);

  await pool.execute(
    "DELETE FROM front_user_identities WHERE user_id = ?",
    [frontId]
  );
  await pool.execute(
    "DELETE FROM api_account_links WHERE principal_id = ?",
    [frontId]
  );
  await pool.execute(
    "DELETE FROM front_users WHERE id = ? AND username = ?",
    [frontId, frontUsername]
  );

  await pool.execute(
    `INSERT INTO front_users (
      id, username, account, contact, profile, invite_code, source,
      password_hash, password_salt, active, failed_attempts, locked_until,
      last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, 'login', ?, ?, 1, 0, NULL, NULL, ?, ?)`,
    [
      frontId,
      frontUsername,
      "认证边界自动验收用户",
      `${frontUsername}@example.invalid`,
      "系统回归",
      front.hash,
      front.salt,
      createdAt,
      createdAt
    ]
  );
  await pool.execute(
    `INSERT INTO admin_users (
      id, username, display_name, role, permissions_json, password_hash,
      password_salt, active, last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'owner', '[]', ?, ?, 1, NULL, ?, ?)`,
    [
      adminId,
      adminUsername,
      "认证边界自动验收管理员",
      admin.hash,
      admin.salt,
      createdAt,
      createdAt
    ]
  );
}

async function restoreContent() {
  if (!originalSiteContent || !jar.has("wcu_admin")) return;

  const response = await request("/_wcu-api/admin/content", {
    json: originalSiteContent,
    method: "PUT"
  });
  requireCondition(response.status === 200, "官网内容恢复失败");
  originalSiteContent = null;
}

async function cleanup() {
  const errors = [];

  try {
    await restoreContent();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "官网内容恢复失败");
  }

  for (const filename of uploadedFiles) {
    await rm(path.join(process.cwd(), "data", "site-media", filename), {
      force: true
    }).catch(() => undefined);
  }

  await pool
    .execute(
      "DELETE FROM admin_audit_logs WHERE admin_user_id = ? OR actor_username IN (?, ?)",
      [adminId, adminUsername, frontUsername]
    )
    .catch(() => undefined);
  await pool
    .execute("DELETE FROM front_user_identities WHERE user_id = ?", [frontId])
    .catch(() => undefined);
  await pool
    .execute("DELETE FROM api_account_links WHERE principal_id = ?", [frontId])
    .catch(() => undefined);
  await pool.execute("DELETE FROM front_users WHERE id = ?", [frontId]).catch(() => undefined);
  await pool.execute("DELETE FROM admin_users WHERE id = ?", [adminId]).catch(() => undefined);
  if (!newApiUserId) {
    const [rows] = await newApiPool
      .execute("SELECT id FROM users WHERE oidc_id = ? LIMIT 1", [
        `creator:${frontId}`
      ])
      .catch(() => [[]]);
    newApiUserId = Number(rows[0]?.id || 0);
  }
  if (newApiUserId) {
    for (const table of ["tokens", "logs", "top_ups", "user_oauth_bindings"]) {
      await newApiPool
        .execute(`DELETE FROM ${table} WHERE user_id = ?`, [newApiUserId])
        .catch(() => undefined);
    }
  }
  await newApiPool
    .execute("DELETE FROM users WHERE id = ? OR oidc_id = ?", [
      newApiUserId,
      `creator:${frontId}`
    ])
    .catch(() => undefined);
  await pool.end().catch(() => undefined);
  await newApiPool.end().catch(() => undefined);

  if (errors.length) throw new Error(errors.join("; "));
}

async function main() {
  await seedAccounts();

  const loginPage = await request("/login?next=%2Fadmin", { accept: "text/html" });
  requireCondition(loginPage.status === 200, "前台登录页状态异常");
  const loginHtml = await loginPage.text();
  requireCondition(
    !/href=["']\/admin(?:[/?#"'])/iu.test(loginHtml),
    "前台登录页暴露了管理员入口"
  );
  requireCondition(!loginHtml.includes("管理员登录"), "前台登录页暴露了管理员登录文案");

  const adminEntry = await request("/admin", { accept: "text/html" });
  requireCondition(adminEntry.status === 200, "原生 /admin 后台页面不可用");
  const adminHtml = await adminEntry.text();
  requireCondition(!adminHtml.includes("JeecgBoot"), "/admin 仍返回 Jeecg 后台");
  requireCondition(
    !adminHtml.includes('data-site-shell="header"'),
    "原生后台重复加载了官网头部"
  );

  const crossedFront = await request("/_wcu-api/auth/login", {
    json: { password: adminPassword, username: adminUsername },
    method: "POST"
  });
  requireCondition(crossedFront.status === 401, "管理员凭据被前台登录接受");

  const frontLogin = await request("/_wcu-api/auth/login", {
    json: { password: frontPassword, username: frontUsername },
    method: "POST"
  });
  requireCondition(frontLogin.status === 200, "普通用户账号密码登录失败");
  requireCondition(jar.has("wcu_platform_session"), "普通用户会话未建立");
  requireCondition(!jar.has("wcu_admin"), "普通用户登录错误建立后台会话");
  const creatorPlatformSession = jar.cookies.get("wcu_platform_session");

  const projects = await request("/projects", { accept: "text/html" });
  requireCondition(projects.status === 200, "普通用户无法进入项目页");

  const crossedAdmin = await request("/_wcu-api/admin/login", {
    json: { password: frontPassword, username: frontUsername },
    method: "POST"
  });
  requireCondition(crossedAdmin.status === 401, "普通用户凭据被后台登录接受");

  const adminLogin = await request("/_wcu-api/admin/login", {
    json: { password: adminPassword, username: adminUsername },
    method: "POST"
  });
  requireCondition(adminLogin.status === 200, "管理员独立登录失败");
  requireCondition(jar.has("wcu_admin"), "后台会话未建立");
  requireCondition(
    jar.cookies.get("wcu_platform_session") === creatorPlatformSession,
    "后台登录覆盖了普通用户会话"
  );

  const content = await request("/_wcu-api/admin/content");
  requireCondition(content.status === 200, "后台内容读取失败");
  originalSiteContent = await json(content);
  requireCondition(Array.isArray(originalSiteContent?.teamMembers), "团队内容结构无效");

  const testContent = structuredClone(originalSiteContent);
  const customGroup = `自动验收分组-${suffix}`;

  if (testContent.teamMembers.length) {
    testContent.teamMembers[0].group = customGroup;
  } else {
    testContent.teamMembers.push({
      avatar: "",
      bio: "",
      expertise: [],
      group: customGroup,
      highlights: [],
      name: "自动验收人物",
      role: "自动验收",
      slug: `audit-member-${Date.now().toString(36)}`
    });
  }

  const saveCustomGroup = await request("/_wcu-api/admin/content", {
    json: testContent,
    method: "PUT"
  });
  requireCondition(saveCustomGroup.status === 200, "自定义团队分组保存失败");

  const form = new FormData();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n6sAAAAASUVORK5CYII=",
    "base64"
  );
  form.append("file", new File([png], "member.png", { type: "image/png" }));
  const upload = await request("/_wcu-api/admin/media", {
    form,
    method: "POST"
  });
  const uploadResult = await json(upload);
  requireCondition(upload.status === 200 && uploadResult?.ok, "人物照片上传失败");
  const uploadedUrl = new URL(uploadResult.url, baseUrl);
  requireCondition(
    uploadedUrl.pathname.startsWith("/media/uploads/"),
    "人物照片上传地址无效"
  );
  const filename = uploadedUrl.pathname.split("/").at(-1);
  requireCondition(Boolean(filename), "人物照片文件名缺失");
  uploadedFiles.add(filename);

  const uploadedImage = await request(uploadedUrl, { accept: "image/*" });
  requireCondition(
    uploadedImage.status === 200 && uploadedImage.headers.get("content-type") === "image/png",
    "已上传人物照片无法读取"
  );

  await restoreContent();

  const adminLogout = await request("/_wcu-api/admin/logout", { method: "POST" });
  requireCondition(adminLogout.status === 200, "管理员退出失败");
  requireCondition(!jar.has("wcu_admin"), "后台会话未清除");
  requireCondition(jar.has("wcu_platform_session"), "管理员退出清除了普通用户会话");

  const projectsAfterAdminLogout = await request("/projects", { accept: "text/html" });
  requireCondition(projectsAfterAdminLogout.status === 200, "后台退出影响了普通用户会话");

  const bookstackLoginPage = await request("/bookstack/login", {
    accept: "text/html"
  });
  requireCondition(bookstackLoginPage.status === 200, "知识库登录页状态异常");
  const bookstackLoginHtml = await bookstackLoginPage.text();
  const csrfToken =
    /name=["']_token["'][^>]*value=["']([^"']+)["']/iu.exec(
      bookstackLoginHtml
    )?.[1] ||
    /value=["']([^"']+)["'][^>]*name=["']_token["']/iu.exec(
      bookstackLoginHtml
    )?.[1];
  requireCondition(Boolean(csrfToken), "知识库 OIDC 登录缺少 CSRF token");
  const loginForm = new URLSearchParams({ _token: csrfToken });
  const bookstackLogin = await request("/bookstack/oidc/login", {
    body: loginForm.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  requireCondition(
    bookstackLogin.status >= 300 && bookstackLogin.status < 400,
    "知识库 OIDC 登录未跳转"
  );
  const bookstackAuthorizeUrl = new URL(
    bookstackLogin.headers.get("location") || "",
    baseUrl
  );
  requireCondition(
    bookstackAuthorizeUrl.origin === baseUrl.origin &&
      bookstackAuthorizeUrl.pathname === "/_wcu-api/oidc/authorize",
    "知识库未进入统一 OIDC 授权"
  );
  const bookstackAuthorize = await request(bookstackAuthorizeUrl, {
    accept: "text/html"
  });
  requireCondition(
    bookstackAuthorize.status >= 300 && bookstackAuthorize.status < 400,
    "知识库 OIDC 授权未回调"
  );
  let bookstackResponse = await request(
    new URL(bookstackAuthorize.headers.get("location") || "", baseUrl),
    { accept: "text/html" }
  );

  for (
    let redirectCount = 0;
    redirectCount < 8 &&
    bookstackResponse.status >= 300 &&
    bookstackResponse.status < 400;
    redirectCount += 1
  ) {
    const destination = new URL(
      bookstackResponse.headers.get("location") || "",
      baseUrl
    );
    requireCondition(
      destination.origin === baseUrl.origin &&
        (destination.pathname === "/bookstack" ||
          destination.pathname.startsWith("/bookstack/")),
      "知识库 OIDC 回调跳转无效"
    );
    bookstackResponse = await request(destination, { accept: "text/html" });
  }

  requireCondition(
    bookstackResponse.status === 200 && jar.has("bookstack_session"),
    "知识库 OIDC 会话未建立"
  );

  const newApiStateResponse = await request("/api/oauth/state");
  const newApiState = await json(newApiStateResponse);
  requireCondition(
    newApiStateResponse.status === 200 &&
      newApiState?.success === true &&
      typeof newApiState.data === "string",
    "灵穹 API OIDC state 获取失败"
  );
  const newApiAuthorizeUrl = new URL("/_wcu-api/oidc/authorize", baseUrl);
  newApiAuthorizeUrl.searchParams.set(
    "client_id",
    process.env.WCU_OIDC_CLIENT_ID || "zhanji-bookstack"
  );
  newApiAuthorizeUrl.searchParams.set(
    "redirect_uri",
    new URL("/oauth/oidc", baseUrl).toString()
  );
  newApiAuthorizeUrl.searchParams.set("response_type", "code");
  newApiAuthorizeUrl.searchParams.set("scope", "openid profile email");
  newApiAuthorizeUrl.searchParams.set("state", newApiState.data);
  const newApiAuthorize = await request(newApiAuthorizeUrl);
  requireCondition(
    newApiAuthorize.status >= 300 && newApiAuthorize.status < 400,
    "灵穹 API OIDC 授权未回调"
  );
  const newApiCallbackUrl = new URL(
    newApiAuthorize.headers.get("location") || "",
    baseUrl
  );
  requireCondition(
    newApiCallbackUrl.origin === baseUrl.origin &&
      newApiCallbackUrl.pathname === "/oauth/oidc",
    "灵穹 API OIDC 回调地址无效"
  );
  const newApiCallback = await request(newApiCallbackUrl, {
    accept: "text/html"
  });
  requireCondition(newApiCallback.status === 200, "灵穹 API OIDC 回调页异常");
  const exchangeUrl = new URL("/api/oauth/oidc", baseUrl);
  exchangeUrl.searchParams.set(
    "code",
    newApiCallbackUrl.searchParams.get("code") || ""
  );
  exchangeUrl.searchParams.set(
    "state",
    newApiCallbackUrl.searchParams.get("state") || ""
  );
  const exchangeResponse = await request(exchangeUrl);
  const exchange = await json(exchangeResponse);
  requireCondition(
    exchangeResponse.status === 200 && exchange?.success === true && exchange?.data?.id,
    "灵穹 API OIDC 凭证交换失败"
  );
  newApiUserId = Number(exchange.data.id);
  const [newApiUsers] = await newApiPool.execute(
    `SELECT id, role, oidc_id
     FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [newApiUserId]
  );
  requireCondition(
    Number(newApiUsers[0]?.role) === 1 &&
      newApiUsers[0]?.oidc_id === `creator:${frontId}`,
    "灵穹 API OIDC 未创建独立普通用户"
  );
  const newApiDashboard = await request("/dashboard", { accept: "text/html" });
  requireCondition(newApiDashboard.status === 200, "灵穹 API 控制台会话未建立");

  console.log(
    JSON.stringify(
      {
        checks: 26,
        result: "passed",
        steps
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
        error: error instanceof Error ? error.message : "认证边界审计失败",
        result: "failed",
        steps
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
