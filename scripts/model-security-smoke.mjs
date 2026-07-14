import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import mysql from "mysql2/promise";

const baseUrl = (
  process.env.MODEL_SECURITY_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost"
).replace(/\/+$/, "");
const apiPrefix = `/${process.env.MODEL_SECURITY_API_PREFIX || "_wcu-api"}`.replace(/\/{2,}/g, "/").replace(/\/$/, "");
const envFiles = [".env.local", ".env", ".env.baota", ".env.new-api.example"];

function envValue(key) {
  if (process.env[key]) return process.env[key];
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const match = readFileSync(file, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u))
      .find((item) => item?.[1] === key);
    if (match?.[2]) return match[2].trim().replace(/^(['"])(.*)\1$/u, "$2");
  }
  return undefined;
}

const serviceSecret =
  process.env.MODEL_SECURITY_SERVICE_SECRET ||
  process.env.JEECG_SERVICE_SECRET ||
  envValue("JEECG_SERVICE_SECRET") ||
  "";

function databaseConfig(database) {
  return {
    charset: "utf8mb4",
    connectionLimit: 3,
    database,
    host: envValue("MYSQL_HOST") || "127.0.0.1",
    password: envValue("MYSQL_PASSWORD") || "zhanji-local-password",
    port: Number(envValue("MYSQL_PORT") || 3306),
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
const creatorId = randomUUID();
const creatorSuffix = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
const creatorUsername = `model.audit.${creatorSuffix}`;
const creatorPassword = `Model-${randomBytes(18).toString("base64url")}!`;
const creatorSubject = `creator:${creatorId}`;
const creatorSalt = randomBytes(16).toString("hex");
const creatorHash = scryptSync(creatorPassword, creatorSalt, 64).toString("hex");
const createdAt = new Date().toISOString();
let creatorCookie = "";
let newApiUserId = 0;

function assert(condition, message, context) {
  if (!condition) throw new Error(`${message}${context ? `\n${JSON.stringify(context, null, 2)}` : ""}`);
}

async function request(path, options = {}, cookie = "") {
  const response = await fetch(`${baseUrl}${apiPrefix}${path}`, {
    ...options,
    headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...(options.headers || {}) },
    redirect: "manual"
  });
  return { body: await response.json().catch(() => null), response };
}

function expect(result, status, label) {
  assert(result.response.status === status, `${label}: expected HTTP ${status}`, { body: result.body, status: result.response.status });
  return result.body;
}

assert(
  serviceSecret,
  "MODEL_SECURITY_SERVICE_SECRET 或 JEECG_SERVICE_SECRET 未配置"
);
const serviceAuth = (path, options = {}) =>
  request(path, {
    ...options,
    headers: {
      "x-lingqiong-service-secret": serviceSecret,
      ...(options.headers || {})
    }
  });
const creatorAuth = (path, options = {}) => request(path, options, creatorCookie);

async function createTemporaryCreator() {
  await mainPool.execute(
    `INSERT INTO front_users (
      id, username, account, contact, profile, invite_code, source,
      password_hash, password_salt, active, failed_attempts, locked_until,
      last_login_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, 'login', ?, ?, 1, 0, NULL, NULL, ?, ?)`,
    [
      creatorId,
      creatorUsername,
      "模型安全自动验收用户",
      `${creatorUsername}@example.invalid`,
      "一次性普通创作者",
      creatorHash,
      creatorSalt,
      createdAt,
      createdAt
    ]
  );
  const [result] = await newApiPool.execute(
    `INSERT INTO users (
      username, password, display_name, role, status, email, oidc_id,
      quota, used_quota, request_count, \`group\`, created_at, last_login_at
    ) VALUES (?, ?, ?, 1, 1, ?, ?, 50000000, 0, 0, 'default', ?, ?)`,
    [
      `model-${creatorSuffix}`,
      randomBytes(32).toString("hex"),
      "模型安全自动验收用户",
      `${creatorUsername}@example.invalid`,
      creatorSubject,
      Math.floor(Date.now() / 1000),
      Math.floor(Date.now() / 1000)
    ]
  );
  newApiUserId = Number(result.insertId || 0);
  assert(newApiUserId > 0, "temporary New API user missing");

  const login = await request("/auth/login", {
    body: JSON.stringify({ password: creatorPassword, username: creatorUsername }),
    method: "POST"
  });
  expect(login, 200, "temporary creator login");
  creatorCookie = (
    login.response.headers.getSetCookie?.() ||
    [login.response.headers.get("set-cookie") || ""]
  )
    .flatMap((value) => value.split(/,(?=\s*[^;,]+=)/u))
    .map((value) => value.split(";", 1)[0].trim())
    .filter(Boolean)
    .join("; ");
  assert(creatorCookie.includes("wcu_platform_session="), "creator platform cookie missing");
}

async function cleanupTemporaryCreator() {
  await mainPool
    .execute(
      "DELETE FROM model_api_calls WHERE actor_id = ? OR node_title = ?",
      [creatorId, marker]
    )
    .catch(() => undefined);
  await mainPool
    .execute("DELETE FROM model_api_usage_buckets WHERE actor_key = ?", [creatorId])
    .catch(() => undefined);
  if (newApiUserId) {
    for (const table of ["user_oauth_bindings", "logs", "top_ups", "tokens"]) {
      await newApiPool
        .execute(`DELETE FROM ${table} WHERE user_id = ?`, [newApiUserId])
        .catch(() => undefined);
    }
    await newApiPool
      .execute("DELETE FROM users WHERE id = ?", [newApiUserId])
      .catch(() => undefined);
  }
  await mainPool
    .execute("DELETE FROM model_billing_audits WHERE principal_id = ?", [creatorId])
    .catch(() => undefined);
  await mainPool
    .execute("DELETE FROM api_account_links WHERE principal_id = ? OR oidc_subject = ?", [
      creatorId,
      creatorSubject
    ])
    .catch(() => undefined);
  await mainPool
    .execute("DELETE FROM front_user_identities WHERE user_id = ?", [creatorId])
    .catch(() => undefined);
  await mainPool
    .execute("DELETE FROM front_users WHERE id = ?", [creatorId])
    .catch(() => undefined);
  await mainPool.end().catch(() => undefined);
  await newApiPool.end().catch(() => undefined);
}
const marker = `model-security-smoke-${Date.now()}`;
let configId;
let projectId;
let activeConfigId;
let activeModel;

try {
  await createTemporaryCreator();

  const blocked = await serviceAuth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "never-send-this-key", baseUrl: "http://127.0.0.1:9999/v1", enabled: true, maxTokens: 100, model: marker, name: marker, provider: "openai-compatible", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(blocked, 400, "loopback SSRF rejection");
  assert(["BLOCKED_MODEL_HOST", "INSECURE_MODEL_BASE_URL"].includes(blocked.body?.error?.code), "unstable SSRF error code", blocked.body);

  const config = await serviceAuth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "boundary-test-key", baseUrl: "https://example.com/v1", enabled: true, maxTokens: 100, model: marker, name: marker, provider: "openai-compatible", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(config, 200, "external config creation");
  configId = config.body?.config?.id;
  assert(configId, "external config id missing");

  const keyBoundary = await serviceAuth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "", baseUrl: "https://example.org/v1", enabled: true, id: configId, maxTokens: 100, model: marker, name: marker, provider: "openai-compatible", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(keyBoundary, 400, "key trust-boundary protection");
  assert(keyBoundary.body?.error?.code === "MODEL_API_KEY_REENTRY_REQUIRED", "key re-entry error mismatch", keyBoundary.body);

  const userIsolatedGateway = await serviceAuth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "must-never-be-stored", baseUrl: "http://new-api:3000/v1", enabled: false, id: configId, maxTokens: 100, model: marker, name: marker, provider: "new-api", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(userIsolatedGateway, 200, "user-isolated gateway config");
  assert(userIsolatedGateway.body?.config?.hasApiKey === false, "shared New API key was retained", userIsolatedGateway.body);

  const configs = await serviceAuth("/admin/model-apis");
  expect(configs, 200, "active New API config lookup");
  const activeConfig = configs.body?.configs?.find((item) => item.enabled && item.provider === "new-api");
  activeConfigId = activeConfig?.id;
  activeModel = activeConfig?.model;
  assert(activeConfigId && activeModel, "enabled New API model missing", configs.body);

  const project = await creatorAuth("/projects", { body: JSON.stringify({ name: marker, type: "security-test" }), method: "POST" });
  expect(project, 200, "test project creation");
  projectId = project.body?.project?.id;
  assert(projectId, "test project id missing");

  const generateBody = JSON.stringify({ node: { model: activeModel, prompt: "只回复：安全限额测试", title: marker }, project: { id: projectId, name: marker } });
  let acceptedCalls = 0;
  let first = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await creatorAuth("/models/generate", { body: generateBody, method: "POST" });
    acceptedCalls += 1;

    if (result.response.status === 200) {
      first = result;
      break;
    }

    assert(
      result.response.status === 502 && result.body?.error?.code === "MODEL_UPSTREAM_ERROR",
      `governed model call attempt ${attempt} failed unexpectedly`,
      { body: result.body, status: result.response.status }
    );
  }

  assert(first, "governed model call did not succeed after transient retries");
  const rpm = first.body?.limits?.rpm;
  assert(Number.isInteger(rpm) && rpm > 0 && rpm <= 20, "set test RPM to 20 or lower", { rpm });

  const rejectedModelBody = JSON.stringify({ node: { model: marker, prompt: "限流计数验收", title: marker }, project: { id: projectId, name: marker } });
  let limited = null;

  // A fixed minute window can roll over while real upstream calls are running.
  // Keep calling for at most two windows and require a persisted 429 guard.
  for (let index = 1; index <= rpm * 2 + 1; index += 1) {
    const result = await creatorAuth("/models/generate", { body: rejectedModelBody, method: "POST" });

    if (result.response.status === 429) {
      limited = result;
      break;
    }

    assert(
      result.response.status === 502 && result.body?.error?.code === "MODEL_UPSTREAM_ERROR",
      `rate budget call ${index + 1} returned an unexpected result`,
      { body: result.body, status: result.response.status }
    );
    acceptedCalls += 1;
  }

  assert(limited, "persistent RPM limit was not reached across two windows", { acceptedCalls, rpm });
  expect(limited, 429, "persistent RPM limit");
  assert(
    limited.body?.error?.code === "MODEL_RATE_LIMIT",
    "rate limit code mismatch",
    limited.body
  );

  const logs = await serviceAuth(`/admin/model-api-calls?configId=${encodeURIComponent(activeConfigId)}&days=30&limit=50`);
  expect(logs, 200, "model audit log query");
  assert(logs.body?.calls?.some((call) => call.projectId === projectId && call.actorId && call.nodeTitle === marker), "actor/project audit association missing", logs.body);

  console.log(JSON.stringify({ acceptedCalls, activeConfigId, auditLogIds: logs.body.calls.map((call) => call.id), configId, ok: true, projectId, rpm, sharedNewApiKeyRejected: true, ssrfBlocked: true, trustBoundaryProtected: true }));
} finally {
  if (projectId) await creatorAuth(`/projects/${projectId}`, { method: "DELETE" }).catch(() => null);
  if (configId) await serviceAuth("/admin/model-apis", { body: JSON.stringify({ id: configId }), method: "DELETE" }).catch(() => null);
  await cleanupTemporaryCreator();
}
