import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase,
  type SqlValue
} from "@/lib/database";

export type ModelProvider = "mock" | "new-api" | "openai-compatible";

export type ModelApiConfig = {
  apiKey?: string;
  baseUrl: string;
  createdAt: string;
  enabled: boolean;
  id: string;
  maxTokens: number;
  model: string;
  name: string;
  provider: ModelProvider;
  systemPrompt: string;
  temperature: number;
  updatedAt: string;
};

export type PublicModelApiConfig = Omit<ModelApiConfig, "apiKey"> & {
  apiKeyPreview: string;
  hasApiKey: boolean;
};

type ModelApiRow = {
  api_key: string | null;
  base_url: string;
  created_at: string;
  enabled: number;
  id: string;
  max_tokens: number;
  model: string;
  name: string;
  provider: string;
  system_prompt: string;
  temperature: number;
  updated_at: string;
};

export type UpsertModelApiConfigInput = {
  apiKey?: string;
  baseUrl: string;
  enabled: boolean;
  id?: string;
  maxTokens: number;
  model: string;
  name: string;
  provider: ModelProvider;
  systemPrompt: string;
  temperature: number;
};

const defaultSystemPrompt =
  "你是战纪宇宙 AI 影视生产线助手。请输出可直接用于影视开发的中文内容，结构清晰，避免虚构真实播放数据、备案号、客户案例。";

export class ModelApiValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ModelApiValidationError";
    this.code = code;
  }
}

export class ModelApiUsageLimitError extends Error {
  code: "MODEL_CONCURRENCY_LIMIT" | "MODEL_DAILY_LIMIT" | "MODEL_RATE_LIMIT";
  retryAfterSeconds: number;

  constructor(
    code: ModelApiUsageLimitError["code"],
    message: string,
    retryAfterSeconds: number
  ) {
    super(message);
    this.name = "ModelApiUsageLimitError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function failValidation(code: string, message: string): never {
  throw new ModelApiValidationError(code, message);
}

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b, c] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function privateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const version = isIP(normalized);

  if (version === 4) {
    return privateIpv4(normalized);
  }

  if (version !== 6) {
    return true;
  }

  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];

  if (mappedIpv4) {
    return privateIpv4(mappedIpv4);
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

function blockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalized === "localhost" ||
    normalized === "metadata" ||
    normalized === "metadata.google.internal" ||
    normalized === "instance-data" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".home") ||
    normalized.endsWith(".lan")
  );
}

function normalizedRemoteBaseUrl(url: URL) {
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path === "/" ? "" : path}`;
}

export async function validateModelApiBaseUrl(
  rawBaseUrl: string,
  provider: ModelProvider
) {
  const value = rawBaseUrl.trim();

  if (provider === "mock") {
    if (value !== "local://mock") {
      failValidation("INVALID_MODEL_BASE_URL", "本地模拟模型只能使用 local://mock。");
    }

    return value;
  }

  if (!value || value.length > 512 || /\s|\\/.test(value)) {
    failValidation("INVALID_MODEL_BASE_URL", "模型 Base URL 格式不正确。");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    failValidation("INVALID_MODEL_BASE_URL", "模型 Base URL 格式不正确。");
  }

  if (url.username || url.password || url.search || url.hash) {
    failValidation(
      "INVALID_MODEL_BASE_URL",
      "模型 Base URL 不能包含账号、密码、查询参数或片段。"
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const approvedNewApiInternal =
    provider === "new-api" && url.protocol === "http:" && hostname === "new-api";

  if (approvedNewApiInternal) {
    return normalizedRemoteBaseUrl(url);
  }

  if (url.protocol !== "https:") {
    failValidation(
      "INSECURE_MODEL_BASE_URL",
      "外部模型 API 必须使用 HTTPS；站内灵穹 API 请使用 http://new-api:3000。"
    );
  }

  if (blockedHostname(hostname)) {
    failValidation("BLOCKED_MODEL_HOST", "模型 API 不能指向本机、内网或元数据服务。");
  }

  if (isIP(hostname)) {
    if (privateNetworkAddress(hostname)) {
      failValidation("BLOCKED_MODEL_HOST", "模型 API 不能指向本机、内网或保留地址。");
    }
  } else {
    let addresses: Array<{ address: string }>;

    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      failValidation("MODEL_HOST_UNRESOLVED", "模型 API 域名当前无法解析。");
    }

    if (!addresses.length || addresses.some((item) => privateNetworkAddress(item.address))) {
      failValidation("BLOCKED_MODEL_HOST", "模型 API 域名解析到了内网或保留地址。");
    }
  }

  return normalizedRemoteBaseUrl(url);
}

export function configuredModelApiBaseUrl(config: ModelApiConfig) {
  const internal =
    config.provider === "new-api"
      ? process.env.NEW_API_INTERNAL_BASE_URL?.trim()
      : undefined;

  return (internal || config.baseUrl).replace(/\/+$/, "");
}

export async function validatedModelApiBaseUrl(config: ModelApiConfig) {
  return validateModelApiBaseUrl(configuredModelApiBaseUrl(config), config.provider);
}

export async function modelApiCompletionEndpoint(config: ModelApiConfig) {
  const baseUrl = await validatedModelApiBaseUrl(config);

  if (baseUrl.endsWith("/chat/completions")) {
    return baseUrl;
  }

  if (config.provider === "new-api" && !baseUrl.endsWith("/v1")) {
    return `${baseUrl}/v1/chat/completions`;
  }

  return `${baseUrl}/chat/completions`;
}

export async function modelApiModelsEndpoint(config: ModelApiConfig) {
  const baseUrl = await validatedModelApiBaseUrl(config);
  const normalized = baseUrl.endsWith("/chat/completions")
    ? baseUrl.slice(0, -"/chat/completions".length)
    : baseUrl;

  return `${normalized}/models`;
}

function modelApiTrustBoundary(baseUrl: string, provider: ModelProvider) {
  if (provider === "mock") {
    return "mock:local";
  }

  try {
    const url = new URL(baseUrl);
    return `${provider}:${url.protocol}//${url.host.toLowerCase()}`;
  } catch {
    return `${provider}:invalid:${baseUrl}`;
  }
}

function normalizeProvider(value: string): ModelProvider {
  if (value === "new-api") {
    return "new-api";
  }

  return value === "mock" ? "mock" : "openai-compatible";
}

function normalizeDisplayName(name: string, provider: ModelProvider) {
  const normalized = name
    .trim()
    .replaceAll("New API", "灵穹 API")
    .replaceAll("NewAPI", "灵穹API");

  if (provider === "new-api" && (!normalized || normalized === "灵穹 API 网关")) {
    return "灵穹 API 网关";
  }

  return normalized || "默认模型 API";
}

function mapConfig(row: ModelApiRow): ModelApiConfig {
  const provider = normalizeProvider(row.provider);

  return {
    apiKey: row.api_key ?? undefined,
    baseUrl: row.base_url,
    createdAt: row.created_at,
    enabled: Boolean(row.enabled),
    id: row.id,
    maxTokens: Number(row.max_tokens),
    model: row.model,
    name: normalizeDisplayName(row.name, provider),
    provider,
    systemPrompt: row.system_prompt,
    temperature: Number(row.temperature),
    updatedAt: row.updated_at
  };
}

function toPublicConfig(config: ModelApiConfig): PublicModelApiConfig {
  const key = config.apiKey ?? "";

  return {
    baseUrl: config.baseUrl,
    createdAt: config.createdAt,
    enabled: config.enabled,
    id: config.id,
    maxTokens: config.maxTokens,
    model: config.model,
    name: config.name,
    provider: config.provider,
    systemPrompt: config.systemPrompt,
    temperature: config.temperature,
    updatedAt: config.updatedAt,
    apiKeyPreview: key ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "未设置",
    hasApiKey: Boolean(key)
  };
}

export async function ensureModelApiSchema() {
  await writeDatabase(async () => undefined);
}

export async function listModelApiConfigs() {
  await ensureModelApiSchema();

  return readDatabase(async (db) =>
    (
      await getRows<ModelApiRow>(
      db,
      `SELECT id, name, provider, base_url, api_key, model, enabled,
        system_prompt, temperature, max_tokens, created_at, updated_at
       FROM model_api_configs
       ORDER BY enabled DESC, updated_at DESC`
      )
    ).map(mapConfig)
  );
}

export async function listPublicModelApiConfigs() {
  return (await listModelApiConfigs()).map(toPublicConfig);
}

export async function getActiveModelApiConfig() {
  await ensureModelApiSchema();

  return readDatabase(async (db) => {
    const row = await getFirstRow<ModelApiRow>(
      db,
      `SELECT id, name, provider, base_url, api_key, model, enabled,
        system_prompt, temperature, max_tokens, created_at, updated_at
       FROM model_api_configs
       WHERE enabled = 1
       ORDER BY updated_at DESC
       LIMIT 1`
    );

    return row ? mapConfig(row) : null;
  });
}

export async function upsertModelApiConfig(input: UpsertModelApiConfigInput) {
  await ensureModelApiSchema();

  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const existing = input.id
    ? await readDatabase((db) =>
        getFirstRow<ModelApiRow>(
          db,
          `SELECT id, name, provider, base_url, api_key, model, enabled,
            system_prompt, temperature, max_tokens, created_at, updated_at
           FROM model_api_configs
           WHERE id = ?`,
          [input.id ?? ""]
        )
      )
    : null;
  const existingConfig = existing ? mapConfig(existing) : null;
  const baseUrl = await validateModelApiBaseUrl(input.baseUrl, input.provider);
  const suppliedApiKey = input.apiKey?.trim() || "";

  if (!input.name.trim() || input.name.trim().length > 255) {
    throw new ModelApiValidationError(
      "INVALID_MODEL_CONFIG",
      "配置名称不能为空且不能超过 255 个字符。"
    );
  }

  if (!input.model.trim() || input.model.trim().length > 255) {
    throw new ModelApiValidationError(
      "INVALID_MODEL_CONFIG",
      "模型名不能为空且不能超过 255 个字符。"
    );
  }

  if (input.systemPrompt.length > 100_000 || suppliedApiKey.length > 16_384) {
    throw new ModelApiValidationError(
      "INVALID_MODEL_CONFIG",
      "模型配置内容超过允许长度。"
    );
  }
  const trustBoundaryChanged = Boolean(
    existingConfig &&
      modelApiTrustBoundary(existingConfig.baseUrl, existingConfig.provider) !==
        modelApiTrustBoundary(baseUrl, input.provider)
  );

  if (
    trustBoundaryChanged &&
    input.provider === "openai-compatible" &&
    input.enabled &&
    !suppliedApiKey
  ) {
    throw new ModelApiValidationError(
      "MODEL_API_KEY_REENTRY_REQUIRED",
      "Base URL 或提供方已改变。为防止旧 Key 被发送到新主机，请重新录入 API Key。"
    );
  }

  const apiKey =
    input.provider === "openai-compatible"
      ? suppliedApiKey || (!trustBoundaryChanged ? existingConfig?.apiKey : null) || null
      : null;
  const config: ModelApiConfig = {
    apiKey: apiKey ?? undefined,
    baseUrl,
    createdAt: existingConfig?.createdAt ?? now,
    enabled: input.enabled,
    id,
    maxTokens: Math.min(32_768, Math.max(1, Number(input.maxTokens) || 1200)),
    model: input.model.trim(),
    provider: input.provider,
    name: normalizeDisplayName(input.name, input.provider),
    systemPrompt: input.systemPrompt.trim() || defaultSystemPrompt,
    temperature: Number.isFinite(input.temperature)
      ? Math.min(2, Math.max(0, input.temperature))
      : 0.7,
    updatedAt: now
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO model_api_configs (
        id, name, provider, base_url, api_key, model, enabled,
        system_prompt, temperature, max_tokens, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         provider = VALUES(provider),
         base_url = VALUES(base_url),
         api_key = VALUES(api_key),
         model = VALUES(model),
         enabled = VALUES(enabled),
         system_prompt = VALUES(system_prompt),
         temperature = VALUES(temperature),
         max_tokens = VALUES(max_tokens),
         updated_at = VALUES(updated_at)`,
      [
        config.id,
        config.name,
        config.provider,
        config.baseUrl,
        config.apiKey ?? null,
        config.model,
        config.enabled ? 1 : 0,
        config.systemPrompt,
        config.temperature,
        config.maxTokens,
        config.createdAt,
        config.updatedAt
      ]
    );
  });

  return toPublicConfig(config);
}

export async function deleteModelApiConfig(id: string) {
  await ensureModelApiSchema();

  await writeDatabase(async (db) => {
    await getFirstRow<{ id: string }>(
      db,
      "SELECT id FROM model_api_configs WHERE id = ? FOR UPDATE",
      [id]
    );
    await db.execute("DELETE FROM model_api_concurrency_leases WHERE config_id = ?", [
      id
    ]);
    await db.execute("DELETE FROM model_api_usage_buckets WHERE config_id = ?", [id]);
    await db.execute("DELETE FROM model_api_configs WHERE id = ?", [id]);
  });
}

function boundedEnvironmentInteger(
  name: string,
  fallback: number,
  min: number,
  max: number
) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function modelApiUsageLimits() {
  return {
    concurrency: boundedEnvironmentInteger("MODEL_API_CONCURRENCY_LIMIT", 2, 1, 20),
    daily: boundedEnvironmentInteger("MODEL_API_DAILY_LIMIT", 100, 1, 100_000),
    rpm: boundedEnvironmentInteger("MODEL_API_RPM_LIMIT", 12, 1, 1_000)
  };
}

function actorUsageKey(actor: { account: string; id?: string }) {
  if (actor.id?.trim()) {
    return `id:${actor.id.trim()}`;
  }

  return `account:${createHash("sha256")
    .update(actor.account.trim().toLowerCase())
    .digest("hex")}`;
}

export type ModelApiUsageReservation = {
  id: string;
  limits: ReturnType<typeof modelApiUsageLimits>;
};

export async function reserveModelApiUsage(
  configId: string,
  actor: { account: string; id?: string }
): Promise<ModelApiUsageReservation> {
  await ensureModelApiSchema();

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const actorKey = actorUsageKey(actor);
  const limits = modelApiUsageLimits();
  const minuteStart = Math.floor(now / 60_000) * 60_000;
  const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  const leaseId = randomUUID();
  const leaseExpiresAt = now + 90_000;

  await writeDatabase(async (db) => {
    const config = await getFirstRow<{ id: string }>(
      db,
      `SELECT id FROM model_api_configs
       WHERE id = ? AND enabled = 1
       FOR UPDATE`,
      [configId]
    );

    if (!config) {
      throw new ModelApiValidationError(
        "MODEL_CONFIG_UNAVAILABLE",
        "模型配置不存在或已停用。"
      );
    }

    await db.execute(
      `DELETE FROM model_api_concurrency_leases
       WHERE config_id = ? AND actor_key = ? AND expires_at <= ?`,
      [configId, actorKey, now]
    );
    const active = await getFirstRow<{ total: number }>(
      db,
      `SELECT COUNT(*) AS total
       FROM model_api_concurrency_leases
       WHERE config_id = ? AND actor_key = ? AND expires_at > ?`,
      [configId, actorKey, now]
    );

    if (Number(active?.total ?? 0) >= limits.concurrency) {
      throw new ModelApiUsageLimitError(
        "MODEL_CONCURRENCY_LIMIT",
        `当前模型并发已达上限（${limits.concurrency}）。`,
        5
      );
    }

    const buckets = [
      {
        limit: limits.rpm,
        retryAfterSeconds: Math.max(1, Math.ceil((minuteStart + 60_000 - now) / 1000)),
        start: minuteStart,
        type: "minute"
      },
      {
        limit: limits.daily,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((dayStart + 86_400_000 - now) / 1000)
        ),
        start: dayStart,
        type: "day"
      }
    ] as const;

    for (const bucket of buckets) {
      const current = await getFirstRow<{ request_count: number }>(
        db,
        `SELECT request_count
         FROM model_api_usage_buckets
         WHERE config_id = ? AND actor_key = ?
           AND window_type = ? AND window_start = ?`,
        [configId, actorKey, bucket.type, bucket.start]
      );

      if (Number(current?.request_count ?? 0) >= bucket.limit) {
        throw new ModelApiUsageLimitError(
          bucket.type === "minute" ? "MODEL_RATE_LIMIT" : "MODEL_DAILY_LIMIT",
          bucket.type === "minute"
            ? `每分钟调用次数已达上限（${bucket.limit}）。`
            : `今日调用次数已达上限（${bucket.limit}）。`,
          bucket.retryAfterSeconds
        );
      }
    }

    for (const bucket of buckets) {
      await db.execute(
        `INSERT INTO model_api_usage_buckets (
          config_id, actor_key, window_type, window_start, request_count, updated_at
         ) VALUES (?, ?, ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE
           request_count = request_count + 1,
           updated_at = VALUES(updated_at)`,
        [configId, actorKey, bucket.type, bucket.start, nowIso]
      );
    }

    await db.execute(
      `INSERT INTO model_api_concurrency_leases (
        id, config_id, actor_key, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
      [leaseId, configId, actorKey, leaseExpiresAt, nowIso]
    );

    await db.execute(
      `DELETE FROM model_api_usage_buckets
       WHERE updated_at < ?
       LIMIT 1000`,
      [new Date(now - 3 * 86_400_000).toISOString()]
    );
    await db.execute(
      `DELETE FROM model_api_concurrency_leases
       WHERE expires_at <= ?
       LIMIT 1000`,
      [now]
    );
  });

  return { id: leaseId, limits };
}

export async function releaseModelApiUsage(reservationId: string) {
  await ensureModelApiSchema();
  await writeDatabase(async (db) => {
    await db.execute("DELETE FROM model_api_concurrency_leases WHERE id = ?", [
      reservationId
    ]);
  });
}

function clipped(value: string | undefined, maxChars: number) {
  const source = value ?? "";

  if (source.length <= maxChars) {
    return { text: source, truncated: false };
  }

  return {
    text: `${source.slice(0, Math.max(0, maxChars - 14))}\n…[已截断]`,
    truncated: true
  };
}

function logRetentionDays() {
  return boundedEnvironmentInteger("MODEL_API_LOG_RETENTION_DAYS", 30, 30, 3650);
}

export type ModelApiCallLog = {
  actorAccount?: string;
  actorId?: string;
  actorRole?: string;
  configId?: string;
  createdAt: string;
  error?: string;
  id: string;
  nodeTitle?: string;
  projectId?: string;
  projectName?: string;
  prompt: string;
  promptTruncated: boolean;
  responseText?: string;
  responseTruncated: boolean;
  status: "error" | "success";
};

type ModelApiCallRow = {
  actor_account: string | null;
  actor_id: string | null;
  actor_role: string | null;
  config_id: string | null;
  created_at: string;
  error: string | null;
  id: string;
  node_title: string | null;
  project_id: string | null;
  project_name: string | null;
  prompt: string;
  prompt_truncated: number;
  response_text: string | null;
  response_truncated: number;
  status: string;
};

function mapModelApiCall(row: ModelApiCallRow): ModelApiCallLog {
  return {
    actorAccount: row.actor_account ?? undefined,
    actorId: row.actor_id ?? undefined,
    actorRole: row.actor_role ?? undefined,
    configId: row.config_id ?? undefined,
    createdAt: row.created_at,
    error: row.error ?? undefined,
    id: row.id,
    nodeTitle: row.node_title ?? undefined,
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    prompt: row.prompt,
    promptTruncated: Boolean(row.prompt_truncated),
    responseText: row.response_text ?? undefined,
    responseTruncated: Boolean(row.response_truncated),
    status: row.status === "success" ? "success" : "error"
  };
}

export async function logModelApiCall(input: {
  actor?: { account: string; id?: string; role?: string };
  configId?: string;
  error?: string;
  nodeTitle?: string;
  project?: { id?: string; name?: string };
  prompt: string;
  responseText?: string;
  status: "error" | "success";
}) {
  await ensureModelApiSchema();

  const prompt = clipped(
    input.prompt,
    boundedEnvironmentInteger("MODEL_API_LOG_PROMPT_CHARS", 12_000, 1000, 100_000)
  );
  const response = clipped(
    input.responseText,
    boundedEnvironmentInteger("MODEL_API_LOG_RESPONSE_CHARS", 24_000, 1000, 200_000)
  );
  const error = clipped(input.error, 4000).text || null;
  const createdAt = new Date().toISOString();
  const cutoff = new Date(
    Date.now() - logRetentionDays() * 86_400_000
  ).toISOString();

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO model_api_calls (
        id, config_id, actor_id, actor_account, actor_role, project_id,
        project_name, node_title, status, prompt, prompt_truncated,
        response_text, response_truncated, error, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.configId ?? null,
        input.actor?.id?.slice(0, 191) ?? null,
        input.actor?.account.slice(0, 255) ?? null,
        input.actor?.role?.slice(0, 40) ?? null,
        input.project?.id?.slice(0, 191) ?? null,
        input.project?.name?.slice(0, 255) ?? null,
        input.nodeTitle?.slice(0, 255) ?? null,
        input.status,
        prompt.text,
        prompt.truncated ? 1 : 0,
        response.text || null,
        response.truncated ? 1 : 0,
        error,
        createdAt
      ]
    );
    await db.execute(
      `DELETE FROM model_api_calls
       WHERE created_at < ?
       LIMIT 1000`,
      [cutoff]
    );
  });
}

export async function listModelApiCalls(options: {
  configId?: string;
  days?: number;
  limit?: number;
} = {}) {
  await ensureModelApiSchema();

  const days = Math.min(3650, Math.max(1, Math.floor(options.days ?? 30)));
  const limit = Math.min(200, Math.max(1, Math.floor(options.limit ?? 50)));
  const clauses = ["created_at >= ?"];
  const params: SqlValue[] = [new Date(Date.now() - days * 86_400_000).toISOString()];

  if (options.configId) {
    clauses.push("config_id = ?");
    params.push(options.configId);
  }

  return readDatabase(async (db) =>
    (
      await getRows<ModelApiCallRow>(
        db,
        `SELECT id, config_id, actor_id, actor_account, actor_role, project_id,
          project_name, node_title, status, prompt, prompt_truncated,
          response_text, response_truncated, error, created_at
         FROM model_api_calls
         WHERE ${clauses.join(" AND ")}
         ORDER BY created_at DESC, id DESC
         LIMIT ${limit}`,
        params
      )
    ).map(mapModelApiCall)
  );
}

export async function purgeModelApiCalls(retentionDays = logRetentionDays()) {
  await ensureModelApiSchema();

  const safeDays = Math.min(3650, Math.max(30, Math.floor(retentionDays)));
  const cutoff = new Date(Date.now() - safeDays * 86_400_000).toISOString();

  return writeDatabase(async (db) => {
    const result = await db.execute("DELETE FROM model_api_calls WHERE created_at < ?", [
      cutoff
    ]);

    return { cutoff, deleted: result.affectedRows, retentionDays: safeDays };
  });
}

export { defaultSystemPrompt };
