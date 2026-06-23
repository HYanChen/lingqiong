import { randomUUID } from "node:crypto";

import { getFirstRow, getRows, readDatabase, writeDatabase } from "@/lib/database";

export type ModelProvider = "mock" | "openai-compatible";

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

function normalizeProvider(value: string): ModelProvider {
  return value === "mock" ? "mock" : "openai-compatible";
}

function mapConfig(row: ModelApiRow): ModelApiConfig {
  return {
    apiKey: row.api_key ?? undefined,
    baseUrl: row.base_url,
    createdAt: row.created_at,
    enabled: Boolean(row.enabled),
    id: row.id,
    maxTokens: Number(row.max_tokens),
    model: row.model,
    name: row.name,
    provider: normalizeProvider(row.provider),
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
  await writeDatabase((db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS model_api_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT,
        model TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        system_prompt TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.7,
        max_tokens INTEGER NOT NULL DEFAULT 1200,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS model_api_calls (
        id TEXT PRIMARY KEY,
        config_id TEXT,
        node_title TEXT,
        status TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response_text TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(config_id) REFERENCES model_api_configs(id)
      );
    `);
  });
}

export async function listModelApiConfigs() {
  await ensureModelApiSchema();

  return readDatabase((db) =>
    getRows<ModelApiRow>(
      db,
      `SELECT id, name, provider, base_url, api_key, model, enabled,
        system_prompt, temperature, max_tokens, created_at, updated_at
       FROM model_api_configs
       ORDER BY enabled DESC, updated_at DESC`
    ).map(mapConfig)
  );
}

export async function listPublicModelApiConfigs() {
  return (await listModelApiConfigs()).map(toPublicConfig);
}

export async function getActiveModelApiConfig() {
  await ensureModelApiSchema();

  return readDatabase((db) => {
    const row = getFirstRow<ModelApiRow>(
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
  const apiKey = input.apiKey?.trim() || existingConfig?.apiKey || null;
  const config: ModelApiConfig = {
    apiKey: apiKey ?? undefined,
    baseUrl: input.baseUrl.trim(),
    createdAt: existingConfig?.createdAt ?? now,
    enabled: input.enabled,
    id,
    maxTokens: Math.max(1, Number(input.maxTokens) || 1200),
    model: input.model.trim(),
    name: input.name.trim() || "默认模型 API",
    provider: input.provider,
    systemPrompt: input.systemPrompt.trim() || defaultSystemPrompt,
    temperature: Number.isFinite(input.temperature) ? input.temperature : 0.7,
    updatedAt: now
  };

  await writeDatabase((db) => {
    db.run(
      `INSERT INTO model_api_configs (
        id, name, provider, base_url, api_key, model, enabled,
        system_prompt, temperature, max_tokens, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         provider = excluded.provider,
         base_url = excluded.base_url,
         api_key = excluded.api_key,
         model = excluded.model,
         enabled = excluded.enabled,
         system_prompt = excluded.system_prompt,
         temperature = excluded.temperature,
         max_tokens = excluded.max_tokens,
         updated_at = excluded.updated_at`,
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

  await writeDatabase((db) => {
    db.run("DELETE FROM model_api_configs WHERE id = ?", [id]);
  });
}

export async function logModelApiCall(input: {
  configId?: string;
  error?: string;
  nodeTitle?: string;
  prompt: string;
  responseText?: string;
  status: "error" | "success";
}) {
  await ensureModelApiSchema();

  await writeDatabase((db) => {
    db.run(
      `INSERT INTO model_api_calls (
        id, config_id, node_title, status, prompt, response_text, error, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.configId ?? null,
        input.nodeTitle ?? null,
        input.status,
        input.prompt,
        input.responseText ?? null,
        input.error ?? null,
        new Date().toISOString()
      ]
    );
  });
}

export { defaultSystemPrompt };
