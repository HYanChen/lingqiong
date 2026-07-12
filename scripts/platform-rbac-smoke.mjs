#!/usr/bin/env node

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const baseUrl = new URL(process.env.BASE_URL || "http://127.0.0.1");

function envValue(key) {
  for (const file of [".env.local", ".env", ".env.new-api.example"]) {
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

async function request(path, { jar, json, method = "GET" } = {}) {
  const headers = new Headers({ Accept: "application/json" });
  if (jar?.cookies.size) headers.set("Cookie", jar.header());
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
  const response = await request("/_wcu-api/auth/login", {
    jar,
    json: { mode: "admin", password, username },
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
let projectId = "";

async function cleanup() {
  if (projectId) {
    await request(`/_wcu-api/projects/${encodeURIComponent(projectId)}`, {
      jar: owner,
      method: "DELETE"
    }).catch(() => null);
  }
  if (viewerId) {
    await request("/_wcu-api/admin/users", {
      jar: owner,
      json: { id: viewerId },
      method: "DELETE"
    }).catch(() => null);
  }
}

async function main() {
  await login(owner, ownerUsername, ownerPassword);

  const createProjectResponse = await request("/_wcu-api/projects", {
    jar: owner,
    json: { name: `RBAC smoke ${suffix}`, type: "权限测试" },
    method: "POST"
  });
  assertStatus(createProjectResponse, 200, "owner creates project");
  projectId = (await body(createProjectResponse))?.project?.id || "";
  assert(projectId, "owner project id missing");

  const createViewerResponse = await request("/_wcu-api/admin/users", {
    jar: owner,
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

  const listResponse = await request("/_wcu-api/projects", { jar: viewer });
  assertStatus(listResponse, 200, "viewer reads project list");
  const projects = (await body(listResponse))?.projects ?? [];
  assert(projects.some((project) => project.id === projectId), "viewer cannot read global project");

  assertStatus(
    await request(`/_wcu-api/projects/${projectId}`, { jar: viewer }),
    200,
    "viewer reads project"
  );
  assertStatus(
    await request(`/_wcu-api/projects/${projectId}`, {
      jar: viewer,
      json: { name: "must-not-change" },
      method: "PATCH"
    }),
    403,
    "viewer cannot update project"
  );
  assertStatus(
    await request(`/_wcu-api/projects/${projectId}/episodes`, {
      jar: viewer,
      json: { episodeNumber: 99, title: "must-not-create" },
      method: "POST"
    }),
    403,
    "viewer cannot write production data"
  );
  assertStatus(
    await request("/_wcu-api/auth/guard", { jar: viewer }),
    403,
    "viewer without system.read cannot access system guard"
  );
  assertStatus(
    await request("/_wcu-api/admin/database", { jar: viewer }),
    403,
    "viewer cannot read database overview"
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

  const disableResponse = await request("/_wcu-api/admin/users", {
    jar: owner,
    json: { active: false, id: viewerId },
    method: "PUT"
  });
  assertStatus(disableResponse, 200, "owner disables viewer");

  const disabledMeResponse = await request("/_wcu-api/auth/me", { jar: viewer });
  assertStatus(disabledMeResponse, 200, "disabled viewer me");
  assert((await body(disabledMeResponse))?.authenticated === false, "disabled platform cookie still valid");
  assertStatus(
    await request("/_wcu-api/projects", { jar: viewer }),
    401,
    "disabled viewer project session invalidated"
  );

  console.log(JSON.stringify({ ok: true, tests: 12 }, null, 2));
}

try {
  await main();
} finally {
  await cleanup();
}
