const baseUrl = (process.env.MODEL_SECURITY_BASE_URL || "http://127.0.0.1").replace(/\/+$/, "");
const apiPrefix = `/${process.env.MODEL_SECURITY_API_PREFIX || "_wcu-api"}`.replace(/\/{2,}/g, "/").replace(/\/$/, "");
const password = process.env.MODEL_SECURITY_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "zhanji2026";
const username = process.env.MODEL_SECURITY_ADMIN_USERNAME || "admin";

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

const login = await request("/auth/login", { body: JSON.stringify({ password, username }), method: "POST" });
expect(login, 200, "admin login");
const cookie = (login.response.headers.getSetCookie?.() || [login.response.headers.get("set-cookie") || ""])
  .map((value) => value.split(";", 1)[0]).filter(Boolean).join("; ");
assert(cookie.includes("wcu_platform_session="), "platform cookie missing");
const auth = (path, options) => request(path, options, cookie);
const marker = `model-security-smoke-${Date.now()}`;
let configId;
let projectId;
let activeConfigId;
let activeModel;

try {
  const blocked = await auth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "never-send-this-key", baseUrl: "http://127.0.0.1:9999/v1", enabled: true, maxTokens: 100, model: marker, name: marker, provider: "openai-compatible", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(blocked, 400, "loopback SSRF rejection");
  assert(["BLOCKED_MODEL_HOST", "INSECURE_MODEL_BASE_URL"].includes(blocked.body?.error?.code), "unstable SSRF error code", blocked.body);

  const config = await auth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "boundary-test-key", baseUrl: "https://example.com/v1", enabled: true, maxTokens: 100, model: marker, name: marker, provider: "openai-compatible", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(config, 200, "external config creation");
  configId = config.body?.config?.id;
  assert(configId, "external config id missing");

  const keyBoundary = await auth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "", baseUrl: "https://example.org/v1", enabled: true, id: configId, maxTokens: 100, model: marker, name: marker, provider: "openai-compatible", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(keyBoundary, 400, "key trust-boundary protection");
  assert(keyBoundary.body?.error?.code === "MODEL_API_KEY_REENTRY_REQUIRED", "key re-entry error mismatch", keyBoundary.body);

  const userIsolatedGateway = await auth("/admin/model-apis", {
    body: JSON.stringify({ apiKey: "must-never-be-stored", baseUrl: "http://new-api:3000/v1", enabled: false, id: configId, maxTokens: 100, model: marker, name: marker, provider: "new-api", systemPrompt: "test", temperature: 0 }),
    method: "POST"
  });
  expect(userIsolatedGateway, 200, "user-isolated gateway config");
  assert(userIsolatedGateway.body?.config?.hasApiKey === false, "shared New API key was retained", userIsolatedGateway.body);

  const configs = await auth("/admin/model-apis");
  expect(configs, 200, "active New API config lookup");
  const activeConfig = configs.body?.configs?.find((item) => item.enabled && item.provider === "new-api");
  activeConfigId = activeConfig?.id;
  activeModel = activeConfig?.model;
  assert(activeConfigId && activeModel, "enabled New API model missing", configs.body);

  const project = await auth("/projects", { body: JSON.stringify({ name: marker, type: "security-test" }), method: "POST" });
  expect(project, 200, "test project creation");
  projectId = project.body?.project?.id;
  assert(projectId, "test project id missing");

  const generateBody = JSON.stringify({ node: { model: activeModel, prompt: "只回复：安全限额测试", title: marker }, project: { id: projectId, name: marker } });
  let acceptedCalls = 0;
  let first = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await auth("/models/generate", { body: generateBody, method: "POST" });
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
    const result = await auth("/models/generate", { body: rejectedModelBody, method: "POST" });

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

  const logs = await auth(`/admin/model-api-calls?configId=${encodeURIComponent(activeConfigId)}&days=30&limit=50`);
  expect(logs, 200, "model audit log query");
  assert(logs.body?.calls?.some((call) => call.projectId === projectId && call.actorId && call.nodeTitle === marker), "actor/project audit association missing", logs.body);

  console.log(JSON.stringify({ acceptedCalls, activeConfigId, auditLogIds: logs.body.calls.map((call) => call.id), configId, ok: true, projectId, rpm, sharedNewApiKeyRejected: true, ssrfBlocked: true, trustBoundaryProtected: true }));
} finally {
  if (projectId) await auth(`/projects/${projectId}`, { method: "DELETE" }).catch(() => null);
  if (configId) await auth("/admin/model-apis", { body: JSON.stringify({ id: configId }), method: "DELETE" }).catch(() => null);
}
