#!/usr/bin/env node

import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import mysql from "mysql2/promise";

const baseUrl = new URL(process.env.BASE_URL || "http://localhost");
const envFiles = [".env.local", ".env", ".env.new-api.example"];
const positiveQuota = 50_000_000;
const internalTokenName = "灵穹创作平台内部调用";

function envValue(key) {
  if (process.env[key]) {
    return process.env[key];
  }

  for (const file of envFiles) {
    if (!existsSync(file)) {
      continue;
    }

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

const mainDatabase = envValue("MYSQL_DATABASE") || "zhanji_universe";
const newApiDatabase = envValue("NEW_API_MYSQL_DATABASE") || "new_api";
const mainPool = mysql.createPool(databaseConfig(mainDatabase));
const newApiPool = mysql.createPool(databaseConfig(newApiDatabase));

function assert(condition, message, context) {
  if (!condition) {
    const suffix = context ? `\n${JSON.stringify(context, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

class CookieJar {
  cookies = new Map();

  capture(response) {
    const values =
      response.headers.getSetCookie?.() ??
      [response.headers.get("set-cookie")].filter(Boolean);

    for (const value of values) {
      for (const header of value.split(/,(?=\s*[^;,]+=)/u)) {
        const pair = header.split(";", 1)[0];
        const separator = pair.indexOf("=");

        if (separator < 1) {
          continue;
        }

        const name = pair.slice(0, separator).trim();
        const cookieValue = pair.slice(separator + 1).trim();

        if (cookieValue) {
          this.cookies.set(name, cookieValue);
        } else {
          this.cookies.delete(name);
        }
      }
    }
  }

  header() {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

async function request(
  path,
  { jar, json, method = "GET", timeoutMs = 30_000 } = {}
) {
  const headers = new Headers({ Accept: "application/json" });

  if (jar?.cookies.size) {
    headers.set("Cookie", jar.header());
  }

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(new URL(path, baseUrl), {
    body: json === undefined ? undefined : JSON.stringify(json),
    headers,
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });
  jar?.capture(response);

  return {
    body: await response.json().catch(() => null),
    response
  };
}

function expectStatus(result, expected, label) {
  assert(
    result.response.status === expected,
    `${label}: expected HTTP ${expected}, got ${result.response.status}`,
    { body: result.body, url: result.response.url }
  );

  return result.body;
}

function secretViolations(value, knownSecrets = [], path = "$", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      secretViolations(item, knownSecrets, `${path}[${index}]`, found)
    );
    return found;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/^(?:access_?token|api_?key|token_?key)$/iu.test(key)) {
        found.push(`${path}.${key}`);
      }
      secretViolations(item, knownSecrets, `${path}.${key}`, found);
    }
    return found;
  }

  if (typeof value === "string") {
    if (/^sk-[A-Za-z0-9_-]{8,}$/u.test(value)) {
      found.push(path);
    }

    if (knownSecrets.some((secret) => secret && value.includes(secret))) {
      found.push(path);
    }
  }

  return found;
}

function assertNoSecrets(payload, knownSecrets, label) {
  const violations = secretViolations(payload, knownSecrets);
  assert(violations.length === 0, `${label}: secret material leaked`, {
    violations
  });
}

async function first(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] ?? null;
}

async function rows(pool, sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

async function waitFor(check, label, timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();

    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`${label}: timed out after ${timeoutMs}ms`);
}

const suffix = `${Date.now().toString(36)}.${randomBytes(4).toString("hex")}`;
const frontId = randomUUID();
const frontUsername = `billing.audit.${suffix}`;
const frontPassword = `Billing-${randomBytes(18).toString("base64url")}!`;
const oidcSubject = `creator:${frontId}`;
const newApiUsername = `billing-${suffix}`;
const newApiEmail = `${newApiUsername}@example.invalid`;
const marker = `account-billing-smoke-${suffix}`;
const nowIso = new Date().toISOString();
const nowUnix = Math.floor(Date.now() / 1000);
const salt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(frontPassword, salt, 64).toString("hex");
const jar = new CookieJar();
const projectIds = [];
let newApiUserId = 0;
let internalTokenId = 0;
let internalTokenKey = "";
let paymentConfigured = false;
let checks = 0;

function checked(condition, message, context) {
  assert(condition, message, context);
  checks += 1;
}

async function createProjectAndEpisode(label) {
  const projectResult = await request("/_wcu-api/projects", {
    jar,
    json: {
      aspectRatio: "16:9",
      deliverables: ["billing-smoke"],
      goal: "可逆账户计费验收",
      name: `${marker}-${label}`,
      source: "automated billing smoke",
      style: "test",
      type: "计费验收"
    },
    method: "POST"
  });
  expectStatus(projectResult, 200, `${label} project creation`);
  const projectId = projectResult.body?.project?.id || "";
  checked(Boolean(projectId), `${label} project id missing`);
  projectIds.push(projectId);

  const episodeResult = await request(
    `/_wcu-api/projects/${encodeURIComponent(projectId)}/episodes`,
    {
      jar,
      json: {
        script: "计费验收测试剧本。",
        summary: "验证模型任务余额门禁。",
        title: `${label} 第一集`
      },
      method: "POST"
    }
  );
  expectStatus(episodeResult, 201, `${label} episode creation`);
  const episodeId = episodeResult.body?.episode?.id || "";
  checked(Boolean(episodeId), `${label} episode id missing`);

  return { episodeId, projectId };
}

async function createTemporaryAccounts() {
  await mainPool.execute(
    `INSERT INTO front_users (
      id, username, account, contact, profile, invite_code, source,
      password_hash, password_salt, active, failed_attempts, locked_until,
      last_login_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, NULL, 'login', ?, ?, 1, 0, NULL, NULL, ?, ?)`,
    [
      frontId,
      frontUsername,
      "计费自动验收用户",
      newApiEmail,
      "普通前台用户计费验收",
      passwordHash,
      salt,
      nowIso,
      nowIso
    ]
  );

  const [result] = await newApiPool.execute(
    `INSERT INTO users (
      username, password, display_name, role, status, email, oidc_id,
      quota, used_quota, request_count, \x60group\x60, created_at, last_login_at
     ) VALUES (?, ?, ?, 1, 1, ?, ?, ?, 0, 0, 'default', ?, ?)`,
    [
      newApiUsername,
      randomBytes(32).toString("hex"),
      "计费自动验收用户",
      newApiEmail,
      oidcSubject,
      positiveQuota,
      nowUnix,
      nowUnix
    ]
  );
  newApiUserId = numberValue(result.insertId);
  checked(newApiUserId > 0, "temporary New API user id missing");

  const [frontUser, newApiUser, adminCollision] = await Promise.all([
    first(
      mainPool,
      "SELECT id, username, source, active FROM front_users WHERE id = ?",
      [frontId]
    ),
    first(
      newApiPool,
      "SELECT id, role, status, oidc_id FROM users WHERE id = ?",
      [newApiUserId]
    ),
    first(
      mainPool,
      "SELECT COUNT(*) AS total FROM admin_users WHERE id = ? OR username = ?",
      [frontId, frontUsername]
    )
  ]);
  checked(
    frontUser?.id === frontId &&
      frontUser?.username === frontUsername &&
      frontUser?.source === "login" &&
      numberValue(frontUser?.active) === 1 &&
      numberValue(adminCollision?.total) === 0,
    "temporary front user was not isolated from admin accounts",
    { adminCollision, frontUser }
  );
  checked(
    numberValue(newApiUser?.id) === newApiUserId &&
      numberValue(newApiUser?.role) === 1 &&
      numberValue(newApiUser?.status) === 1 &&
      newApiUser?.oidc_id === oidcSubject,
    "temporary New API account is not a common OIDC user",
    newApiUser
  );
}

async function login() {
  const result = await request("/_wcu-api/auth/login", {
    jar,
    json: { password: frontPassword, username: frontUsername },
    method: "POST"
  });
  const payload = expectStatus(result, 200, "temporary front user login");
  checked(
    payload?.user?.id === frontId &&
      payload?.user?.role === "creator" &&
      payload?.user?.source === "login",
    "front login did not establish a creator identity",
    payload
  );
  checked(jar.header().includes("wcu_platform_session="), "platform cookie missing");
  checked(!jar.header().includes("wcu_admin="), "front login created an admin cookie");
}

async function runAudit() {
  await createTemporaryAccounts();
  await login();

  const activeConfig = await first(
    mainPool,
    `SELECT id, model
     FROM model_api_configs
     WHERE enabled = 1 AND provider = 'new-api'
     ORDER BY updated_at DESC
     LIMIT 1`
  );
  checked(Boolean(activeConfig?.id && activeConfig?.model), "enabled New API model missing");

  const overviewResult = await request("/_wcu-api/account/overview", { jar });
  const overview = expectStatus(overviewResult, 200, "account overview");
  checked(overview?.ok === true && overview?.connected === true, "account is not connected", overview);
  checked(
    numberValue(overview?.account?.id) === newApiUserId,
    "account overview mapped the wrong New API user",
    overview
  );
  assertNoSecrets(overview, [], "account overview");

  const initialLink = await first(
    mainPool,
    `SELECT principal_type, principal_id, oidc_subject, new_api_user_id,
      internal_token_id, link_status
     FROM api_account_links
     WHERE principal_type = 'creator' AND principal_id = ?`,
    [frontId]
  );
  checked(
    initialLink?.principal_type === "creator" &&
      initialLink?.principal_id === frontId &&
      initialLink?.oidc_subject === oidcSubject &&
      numberValue(initialLink?.new_api_user_id) === newApiUserId &&
      initialLink?.link_status === "active",
    "initial API account link is invalid",
    initialLink
  );

  const billingResult = await request("/_wcu-api/account/billing", { jar });
  const billing = expectStatus(billingResult, 200, "billing overview");
  const bridgeUser = await first(
    newApiPool,
    "SELECT access_token FROM users WHERE id = ?",
    [newApiUserId]
  );
  const bridgeAccessToken = bridgeUser?.access_token || "";
  checked(Boolean(bridgeAccessToken), "account bridge access token was not initialized");
  assertNoSecrets(billing, [bridgeAccessToken], "billing overview");
  paymentConfigured =
    billing?.settings?.enableOnlineTopup === true &&
    billing?.settings?.complianceConfirmed === true &&
    Array.isArray(billing?.settings?.paymentMethods) &&
    billing.settings.paymentMethods.length > 0;
  checked(
    typeof billing?.settings?.enableOnlineTopup === "boolean" &&
      typeof billing?.settings?.complianceConfirmed === "boolean" &&
      typeof billing?.settings?.enableRedemption === "boolean" &&
      Array.isArray(billing?.settings?.paymentMethods),
    "payment capability state is not explicit",
    billing?.settings
  );

  const gateResource = await createProjectAndEpisode("zero-balance");
  await newApiPool.execute("UPDATE users SET quota = 0 WHERE id = ?", [newApiUserId]);

  const zeroOverviewResult = await request("/_wcu-api/account/overview", { jar });
  const zeroOverview = expectStatus(zeroOverviewResult, 200, "zero balance overview");
  checked(
    zeroOverview?.modelAccess?.allowed === false &&
      zeroOverview?.modelAccess?.code === "API_BALANCE_REQUIRED",
    "zero balance account was not blocked",
    zeroOverview?.modelAccess
  );

  const zeroBaseline = {
    audits: numberValue(
      (
        await first(
          mainPool,
          "SELECT COUNT(*) AS total FROM model_billing_audits WHERE principal_id = ?",
          [frontId]
        )
      )?.total
    ),
    jobs: numberValue(
      (
        await first(
          mainPool,
          "SELECT COUNT(*) AS total FROM generation_jobs WHERE project_id = ?",
          [gateResource.projectId]
        )
      )?.total
    ),
    logs: numberValue(
      (
        await first(newApiPool, "SELECT COUNT(*) AS total FROM logs WHERE user_id = ?", [newApiUserId])
      )?.total
    ),
    tokens: numberValue(
      (
        await first(newApiPool, "SELECT COUNT(*) AS total FROM tokens WHERE user_id = ? AND deleted_at IS NULL", [newApiUserId])
      )?.total
    ),
    user: await first(
      newApiPool,
      "SELECT quota, used_quota, request_count FROM users WHERE id = ?",
      [newApiUserId]
    )
  };

  const blockedGenerate = await request("/_wcu-api/models/generate", {
    jar,
    json: {
      node: {
        model: activeConfig.model,
        prompt: "零余额门禁验收，不应请求上游。",
        title: marker,
        type: "billing-smoke"
      },
      project: {
        id: gateResource.projectId,
        name: `${marker}-zero-balance`
      }
    },
    method: "POST"
  });
  expectStatus(blockedGenerate, 402, "zero balance model generation");
  checked(
    blockedGenerate.body?.error?.code === "API_BALANCE_REQUIRED",
    "zero balance model error code mismatch",
    blockedGenerate.body
  );

  const blockedJob = await request(
    `/_wcu-api/projects/${encodeURIComponent(gateResource.projectId)}/generation-jobs`,
    {
      jar,
      json: {
        episodeId: gateResource.episodeId,
        input: { prompt: "zero balance" },
        resourceId: gateResource.episodeId,
        resourceType: "episode",
        taskType: "script_analysis"
      },
      method: "POST"
    }
  );
  expectStatus(blockedJob, 402, "zero balance generation job");
  checked(
    blockedJob.body?.error?.code === "API_BALANCE_REQUIRED",
    "zero balance job error code mismatch",
    blockedJob.body
  );

  const zeroAfter = {
    audits: numberValue(
      (
        await first(
          mainPool,
          "SELECT COUNT(*) AS total FROM model_billing_audits WHERE principal_id = ?",
          [frontId]
        )
      )?.total
    ),
    jobs: numberValue(
      (
        await first(
          mainPool,
          "SELECT COUNT(*) AS total FROM generation_jobs WHERE project_id = ?",
          [gateResource.projectId]
        )
      )?.total
    ),
    logs: numberValue(
      (
        await first(newApiPool, "SELECT COUNT(*) AS total FROM logs WHERE user_id = ?", [newApiUserId])
      )?.total
    ),
    tokens: numberValue(
      (
        await first(newApiPool, "SELECT COUNT(*) AS total FROM tokens WHERE user_id = ? AND deleted_at IS NULL", [newApiUserId])
      )?.total
    ),
    user: await first(
      newApiPool,
      "SELECT quota, used_quota, request_count FROM users WHERE id = ?",
      [newApiUserId]
    )
  };
  checked(
    zeroAfter.audits === zeroBaseline.audits &&
      zeroAfter.jobs === zeroBaseline.jobs &&
      zeroAfter.logs === zeroBaseline.logs &&
      zeroAfter.tokens === zeroBaseline.tokens &&
      numberValue(zeroAfter.user?.quota) === 0 &&
      numberValue(zeroAfter.user?.used_quota) === numberValue(zeroBaseline.user?.used_quota) &&
      numberValue(zeroAfter.user?.request_count) === numberValue(zeroBaseline.user?.request_count),
    "zero balance request reached token provisioning, queueing, billing audit, or upstream usage",
    { after: zeroAfter, before: zeroBaseline }
  );

  await newApiPool.execute("UPDATE users SET quota = ? WHERE id = ?", [
    positiveQuota,
    newApiUserId
  ]);
  const positiveOverviewResult = await request("/_wcu-api/account/overview", { jar });
  const positiveOverview = expectStatus(
    positiveOverviewResult,
    200,
    "positive balance overview"
  );
  checked(
    positiveOverview?.modelAccess?.allowed === true &&
      positiveOverview?.modelAccess?.code === "API_MODEL_ACCESS_READY",
    "positive balance did not enable model access",
    positiveOverview?.modelAccess
  );

  const positiveResource = await createProjectAndEpisode("positive-balance");
  const queuedJob = await request(
    `/_wcu-api/projects/${encodeURIComponent(positiveResource.projectId)}/generation-jobs`,
    {
      jar,
      json: {
        episodeId: positiveResource.episodeId,
        input: { prompt: "positive balance queue" },
        resourceId: positiveResource.episodeId,
        resourceType: "episode",
        taskType: "script_analysis"
      },
      method: "POST"
    }
  );
  expectStatus(queuedJob, 201, "positive balance generation job");
  checked(
    queuedJob.body?.job?.status === "queued" &&
      queuedJob.body?.job?.episodeId === positiveResource.episodeId,
    "positive balance job was not queued",
    queuedJob.body
  );

  const linked = await first(
    mainPool,
    `SELECT principal_type, principal_id, oidc_subject, new_api_user_id,
      internal_token_id, link_status
     FROM api_account_links
     WHERE principal_type = 'creator' AND principal_id = ?`,
    [frontId]
  );
  internalTokenId = numberValue(linked?.internal_token_id);
  const token = await first(
    newApiPool,
    `SELECT id, user_id, \x60key\x60, name, status, unlimited_quota, remain_quota
     FROM tokens
     WHERE id = ? AND deleted_at IS NULL`,
    [internalTokenId]
  );
  internalTokenKey = token?.key || "";
  checked(
    linked?.principal_type === "creator" &&
      linked?.principal_id === frontId &&
      linked?.oidc_subject === oidcSubject &&
      numberValue(linked?.new_api_user_id) === newApiUserId &&
      linked?.link_status === "active" &&
      internalTokenId > 0,
    "final API account link is invalid",
    linked
  );
  checked(
    numberValue(token?.user_id) === newApiUserId &&
      token?.name === internalTokenName &&
      numberValue(token?.status) === 1 &&
      numberValue(token?.unlimited_quota) === 1,
    "internal unlimited token is missing or belongs to another user",
    token
      ? {
          id: token.id,
          name: token.name,
          status: token.status,
          unlimitedQuota: numberValue(token.unlimited_quota) === 1,
          userId: token.user_id
        }
      : null
  );

  const otherQuotasBefore = new Map(
    (
      await rows(
        newApiPool,
        "SELECT id, quota FROM users WHERE id <> ? AND deleted_at IS NULL ORDER BY id",
        [newApiUserId]
      )
    ).map((item) => [String(item.id), String(item.quota)])
  );
  const modelQuotaBefore = numberValue(
    (await first(newApiPool, "SELECT quota FROM users WHERE id = ?", [newApiUserId]))?.quota
  );
  const upstreamGenerate = await request("/_wcu-api/models/generate", {
    jar,
    json: {
      node: {
        model: activeConfig.model,
        prompt: "只回复：计费验收通过",
        title: `${marker}-paid-call`,
        type: "billing-smoke"
      },
      project: {
        id: positiveResource.projectId,
        name: `${marker}-positive-balance`
      }
    },
    method: "POST",
    timeoutMs: 120_000
  });

  if (upstreamGenerate.response.status !== 200) {
    throw new Error(
      `真实上游模型调用失败：HTTP ${upstreamGenerate.response.status}\n${JSON.stringify(
        upstreamGenerate.body,
        null,
        2
      )}`
    );
  }
  checked(upstreamGenerate.body?.ok === true, "paid model response is invalid", upstreamGenerate.body);

  const chargedUser = await waitFor(async () => {
    const user = await first(
      newApiPool,
      "SELECT quota, used_quota, request_count FROM users WHERE id = ?",
      [newApiUserId]
    );
    return numberValue(user?.quota) < modelQuotaBefore ? user : null;
  }, "temporary user quota deduction");
  checked(
    numberValue(chargedUser.quota) < modelQuotaBefore &&
      numberValue(chargedUser.used_quota) > 0 &&
      numberValue(chargedUser.request_count) > 0,
    "paid model call did not charge the temporary user",
    chargedUser
  );

  const succeededAudit = await waitFor(async () => {
    const audit = await first(
      mainPool,
      `SELECT id, request_id, principal_id, new_api_user_id, new_api_token_id,
        project_id, capability, status, quota_before, quota_after, quota_charged,
        error_code
       FROM model_billing_audits
       WHERE principal_id = ? AND new_api_user_id = ? AND project_id = ?
         AND capability = 'models.generate'
       ORDER BY created_at DESC
       LIMIT 1`,
      [frontId, newApiUserId, positiveResource.projectId]
    );
    return audit?.status === "succeeded" ? audit : null;
  }, "successful billing audit");
  checked(
    numberValue(succeededAudit.new_api_token_id) === internalTokenId &&
      succeededAudit.error_code === null,
    "billing audit was not associated with the temporary user token",
    succeededAudit
  );

  const userUsageLog = await first(
    newApiPool,
    `SELECT id, user_id, token_id, quota, model_name
     FROM logs
     WHERE user_id = ? AND token_id = ? AND quota > 0
     ORDER BY id DESC
     LIMIT 1`,
    [newApiUserId, internalTokenId]
  );
  checked(Boolean(userUsageLog), "New API usage log did not use the temporary user token");

  const otherQuotasAfter = new Map(
    (
      await rows(
        newApiPool,
        "SELECT id, quota FROM users WHERE id <> ? AND deleted_at IS NULL ORDER BY id",
        [newApiUserId]
      )
    ).map((item) => [String(item.id), String(item.quota)])
  );
  checked(
    otherQuotasBefore.size === otherQuotasAfter.size &&
      [...otherQuotasBefore].every(
        ([id, quota]) => otherQuotasAfter.get(id) === quota
      ),
    "paid model call changed another New API user's quota",
    {
      after: Object.fromEntries(otherQuotasAfter),
      before: Object.fromEntries(otherQuotasBefore)
    }
  );

  const finalBillingResult = await request("/_wcu-api/account/billing", { jar });
  const finalBilling = expectStatus(finalBillingResult, 200, "post-token billing overview");
  assertNoSecrets(
    finalBilling,
    [bridgeAccessToken, internalTokenKey, `sk-${internalTokenKey}`],
    "post-token billing overview"
  );
}

async function deleteProjectData(connection, projectId) {
  for (const table of [
    "generation_jobs",
    "voiceovers",
    "storyboards",
    "compositions",
    "elements",
    "episodes",
    "project_canvas_states",
    "project_uploads"
  ]) {
    await connection.execute(`DELETE FROM ${table} WHERE project_id = ?`, [projectId]);
  }
  await connection.execute("DELETE FROM projects WHERE id = ?", [projectId]);
}

async function cleanup() {
  const errors = [];

  const cleanupStep = async (label, operation, options = {}) => {
    try {
      await operation();
    } catch (error) {
      if (options.optional && error?.code === "ER_NO_SUCH_TABLE") {
        return;
      }
      errors.push(`${label}: ${error instanceof Error ? error.message : error}`);
    }
  };

  await cleanupStep("discover project residue", async () => {
    const discovered = await rows(
      mainPool,
      "SELECT id FROM projects WHERE owner_id = ? OR name LIKE ?",
      [frontId, `${marker}%`]
    );
    for (const item of discovered) {
      const id = String(item.id || "");
      if (id && !projectIds.includes(id)) {
        projectIds.push(id);
      }
    }
  });

  if (!newApiUserId) {
    await cleanupStep("discover New API user residue", async () => {
      const user = await first(
        newApiPool,
        "SELECT id FROM users WHERE oidc_id = ? LIMIT 1",
        [oidcSubject]
      );
      newApiUserId = numberValue(user?.id);
    });
  }

  await cleanupStep("project cleanup", async () => {
    const connection = await mainPool.getConnection();
    try {
      await connection.beginTransaction();
      for (const projectId of [...projectIds].reverse()) {
        await deleteProjectData(connection, projectId);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => null);
      throw error;
    } finally {
      connection.release();
    }
  });

  if (newApiUserId) {
    await cleanupStep("New API token cleanup", () =>
      newApiPool.execute("DELETE FROM tokens WHERE user_id = ?", [newApiUserId])
    );
    await cleanupStep("New API usage log cleanup", () =>
      newApiPool.execute("DELETE FROM logs WHERE user_id = ?", [newApiUserId])
    );
    await cleanupStep("New API top-up cleanup", () =>
      newApiPool.execute("DELETE FROM top_ups WHERE user_id = ?", [newApiUserId])
    );
    await cleanupStep("New API user cleanup", () =>
      newApiPool.execute("DELETE FROM users WHERE id = ? OR oidc_id = ?", [
        newApiUserId,
        oidcSubject
      ])
    );
  }

  await cleanupStep(
    "billing audit cleanup",
    () =>
      mainPool.execute(
      "DELETE FROM model_billing_audits WHERE principal_id = ? OR new_api_user_id = ?",
      [frontId, newApiUserId]
      ),
    { optional: true }
  );
  await cleanupStep(
    "API account link cleanup",
    () =>
      mainPool.execute(
      "DELETE FROM api_account_links WHERE principal_id = ? OR oidc_subject = ? OR new_api_user_id = ?",
      [frontId, oidcSubject, newApiUserId]
      ),
    { optional: true }
  );
  await cleanupStep("model call cleanup", () =>
    mainPool.execute("DELETE FROM model_api_calls WHERE actor_id = ?", [frontId])
  );
  await cleanupStep("model rate bucket cleanup", () =>
    mainPool.execute("DELETE FROM model_api_usage_buckets WHERE actor_key = ?", [
      `id:${frontId}`
    ])
  );
  await cleanupStep("model concurrency lease cleanup", () =>
    mainPool.execute("DELETE FROM model_api_concurrency_leases WHERE actor_key = ?", [
      `id:${frontId}`
    ])
  );
  await cleanupStep("front identity cleanup", () =>
    mainPool.execute("DELETE FROM front_user_identities WHERE user_id = ?", [
      frontId
    ])
  );
  await cleanupStep("temporary front user cleanup", () =>
    mainPool.execute("DELETE FROM front_users WHERE id = ? OR username = ?", [
      frontId,
      frontUsername
    ])
  );

  try {
    const projectPlaceholders = projectIds.map(() => "?").join(",");
    const optionalCount = async (pool, sql, params) => {
      try {
        return numberValue((await first(pool, sql, params))?.total);
      } catch (error) {
        if (error?.code === "ER_NO_SUCH_TABLE") {
          return 0;
        }
        throw error;
      }
    };
    let projectData = 0;

    if (projectIds.length) {
      for (const table of [
        "generation_jobs",
        "voiceovers",
        "storyboards",
        "compositions",
        "elements",
        "episodes",
        "project_canvas_states",
        "project_uploads"
      ]) {
        projectData += numberValue(
          (
            await first(
              mainPool,
              `SELECT COUNT(*) AS total FROM ${table} WHERE project_id IN (${projectPlaceholders})`,
              projectIds
            )
          )?.total
        );
      }
    }
    const residual = {
      frontIdentity: numberValue(
        (
          await first(
            mainPool,
            "SELECT COUNT(*) AS total FROM front_user_identities WHERE user_id = ?",
            [frontId]
          )
        )?.total
      ),
      frontUser: numberValue(
        (
          await first(
            mainPool,
            "SELECT COUNT(*) AS total FROM front_users WHERE id = ? OR username = ?",
            [frontId, frontUsername]
          )
        )?.total
      ),
      billingAudit: await optionalCount(
        mainPool,
        "SELECT COUNT(*) AS total FROM model_billing_audits WHERE principal_id = ? OR new_api_user_id = ?",
        [frontId, newApiUserId]
      ),
      link: await optionalCount(
        mainPool,
        "SELECT COUNT(*) AS total FROM api_account_links WHERE principal_id = ? OR oidc_subject = ? OR new_api_user_id = ?",
        [frontId, oidcSubject, newApiUserId]
      ),
      modelCalls: numberValue(
        (await first(mainPool, "SELECT COUNT(*) AS total FROM model_api_calls WHERE actor_id = ?", [frontId]))?.total
      ),
      modelConcurrency: numberValue(
        (
          await first(
            mainPool,
            "SELECT COUNT(*) AS total FROM model_api_concurrency_leases WHERE actor_key = ?",
            [`id:${frontId}`]
          )
        )?.total
      ),
      modelUsage: numberValue(
        (
          await first(
            mainPool,
            "SELECT COUNT(*) AS total FROM model_api_usage_buckets WHERE actor_key = ?",
            [`id:${frontId}`]
          )
        )?.total
      ),
      newApiToken: numberValue(
        (await first(newApiPool, "SELECT COUNT(*) AS total FROM tokens WHERE user_id = ?", [newApiUserId]))?.total
      ),
      newApiUser: numberValue(
        (await first(newApiPool, "SELECT COUNT(*) AS total FROM users WHERE id = ? OR oidc_id = ?", [newApiUserId, oidcSubject]))?.total
      ),
      projectData,
      projects: projectIds.length
        ? numberValue(
            (
              await first(
                mainPool,
                `SELECT COUNT(*) AS total FROM projects WHERE id IN (${projectPlaceholders})`,
                projectIds
              )
            )?.total
          )
        : 0
    };
    assert(
      Object.values(residual).every((value) => value === 0),
      "billing smoke cleanup left residual data",
      residual
    );
  } catch (error) {
    errors.push(`cleanup verification: ${error instanceof Error ? error.message : error}`);
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }
}

let auditError = null;
let cleanupError = null;

try {
  await runAudit();
} catch (error) {
  auditError = error;
} finally {
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }
  await Promise.allSettled([mainPool.end(), newApiPool.end()]);
}

if (auditError || cleanupError) {
  const messages = [
    auditError instanceof Error ? auditError.message : auditError,
    cleanupError instanceof Error ? cleanupError.message : cleanupError
  ].filter(Boolean);
  throw new Error(messages.join("\nCleanup failure:\n"));
}

console.log(
  JSON.stringify(
    {
      checks,
      cleanupVerified: true,
      modelChargedTemporaryUser: true,
      ok: true,
      paymentConfigured,
      userIsolationVerified: true
    },
    null,
    2
  )
);
