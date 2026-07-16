#!/usr/bin/env node

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const baseUrl = new URL(process.env.BASE_URL || "http://localhost");

function envValue(key) {
  for (const file of [".env.local", ".env", ".env.baota", ".env.new-api.example"]) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
      .find((item) => item?.[1] === key);
    if (match?.[2]) return match[2].trim().replace(/^(['"])(.*)\1$/u, "$2");
  }
  return undefined;
}

const ownerUsername = process.env.ADMIN_USERNAME || envValue("ADMIN_USERNAME") || "admin";
const ownerPassword = process.env.ADMIN_PASSWORD || envValue("ADMIN_PASSWORD") || "zhanji2026";
const serviceSecret =
  process.env.RBAC_TEST_SERVICE_SECRET ||
  process.env.WCU_INTERNAL_SERVICE_SECRET ||
  envValue("WCU_INTERNAL_SERVICE_SECRET") ||
  "zhanji-wcu-internal-service-local-secret";

class CookieJar {
  cookies = new Map();

  capture(response) {
    const values = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter(Boolean);
    for (const header of values) {
      const pair = header.split(";", 1)[0];
      const index = pair.indexOf("=");
      if (index < 1) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
  }

  header() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }
}

async function request(path, { jar, json, method = "GET", service = false } = {}) {
  const headers = new Headers({ Accept: "application/json" });
  if (jar?.cookies.size) headers.set("Cookie", jar.header());
  if (service && serviceSecret) {
    headers.set("X-WCU-Internal-Service-Secret", serviceSecret);
  }
  if (json !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    body: json === undefined ? undefined : JSON.stringify(json),
    headers,
    method,
    redirect: "manual"
  });
  jar?.capture(response);
  return response;
}

async function body(response) {
  return response.json().catch(() => null);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(response, status, label) {
  assert(response.status === status, `${label}: expected ${status}, got ${response.status}`);
}

async function login(jar, username, password) {
  const response = await request("/_wcu-api/admin/login", {
    jar,
    json: { password, username },
    method: "POST"
  });
  assertStatus(response, 200, `${username} login`);
}

const owner = new CookieJar();
const viewer = new CookieJar();
const suffix = randomUUID().slice(0, 8);
const viewerUsername = `rbac.viewer.${suffix}`;
const viewerPassword = `Rbac-${randomBytes(12).toString("base64url")}`;
let viewerId = "";

function ownerRequest(path, options = {}) {
  return request(path, {
    ...options,
    ...(serviceSecret ? { service: true } : { jar: owner })
  });
}

async function cleanup() {
  if (viewerId) {
    await ownerRequest("/_wcu-api/admin/users", {
      json: { id: viewerId },
      method: "DELETE"
    }).catch(() => null);
  }
}

async function main() {
  if (!serviceSecret) {
    await login(owner, ownerUsername, ownerPassword);
  }

  const createViewerResponse = await ownerRequest("/_wcu-api/admin/users", {
    json: {
      active: true,
      displayName: "RBAC 只读测试",
      password: viewerPassword,
      permissions: ["content.read", "projects.read", "settings.read"],
      role: "viewer",
      username: viewerUsername
    },
    method: "POST"
  });
  assertStatus(createViewerResponse, 201, "owner creates viewer");
  viewerId = (await body(createViewerResponse))?.user?.id || "";
  assert(viewerId, "viewer id missing");

  await login(viewer, viewerUsername, viewerPassword);

  const contentResponse = await request("/_wcu-api/admin/content", { jar: viewer });
  assertStatus(contentResponse, 200, "viewer reads content");
  const content = await body(contentResponse);
  assert(Array.isArray(content?.teamMembers), "viewer content response invalid");
  assertStatus(
    await request("/_wcu-api/admin/content", {
      jar: viewer,
      json: content,
      method: "PUT"
    }),
    403,
    "viewer cannot update content"
  );
  assertStatus(
    await request("/_wcu-api/projects", { jar: viewer }),
    401,
    "admin session cannot cross into creator project session"
  );
  assertStatus(
    await request("/_wcu-api/admin/database", { jar: viewer }),
    403,
    "viewer cannot read database overview"
  );
  assertStatus(
    await request("/_wcu-api/admin/users", { jar: viewer }),
    403,
    "viewer cannot manage admin users"
  );

  const loginSettingsResponse = await request("/_wcu-api/admin/login-settings", {
    jar: viewer
  });
  assertStatus(loginSettingsResponse, 200, "viewer reads masked login settings");
  const maskedSettings = await body(loginSettingsResponse);
  assert(!("appSecret" in (maskedSettings?.wechat ?? {})), "wechat secret leaked");
  assert(
    Object.values(maskedSettings?.oauth ?? {}).every(
      (provider) => !("clientSecret" in provider)
    ),
    "oauth secret leaked"
  );
  assertStatus(
    await request("/_wcu-api/admin/login-settings", {
      jar: viewer,
      json: maskedSettings,
      method: "PUT"
    }),
    403,
    "viewer cannot update login settings"
  );
  const viewerMeResponse = await request("/_wcu-api/admin/me", { jar: viewer });
  assertStatus(viewerMeResponse, 200, "viewer admin session available");
  assert((await body(viewerMeResponse))?.authenticated === true, "viewer admin session missing");

  const disableResponse = await ownerRequest("/_wcu-api/admin/users", {
    json: { active: false, id: viewerId },
    method: "PUT"
  });
  assertStatus(disableResponse, 200, "owner disables viewer");

  const disabledMeResponse = await request("/_wcu-api/admin/me", { jar: viewer });
  assertStatus(disabledMeResponse, 200, "disabled viewer me");
  assert((await body(disabledMeResponse))?.authenticated === false, "disabled admin cookie still valid");
  assertStatus(
    await request("/_wcu-api/admin/content", { jar: viewer }),
    401,
    "disabled viewer admin session invalidated"
  );

  console.log(JSON.stringify({ ok: true, tests: 13 }, null, 2));
}

try {
  await main();
} finally {
  await cleanup();
}
