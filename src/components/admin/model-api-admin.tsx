"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Trash2,
  XCircle
} from "lucide-react";

import { cn } from "@/lib/utils";

type PublicModelApiConfig = {
  apiKeyPreview: string;
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  id: string;
  maxTokens: number;
  model: string;
  name: string;
  provider: "mock" | "new-api" | "openai-compatible";
  systemPrompt: string;
  temperature: number;
  updatedAt: string;
};

type ApiForm = {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  id: string;
  maxTokens: number;
  model: string;
  name: string;
  provider: "mock" | "new-api" | "openai-compatible";
  systemPrompt: string;
  temperature: number;
};

const emptyForm: ApiForm = {
  apiKey: "",
  baseUrl: "http://new-api:3000/v1",
  enabled: true,
  id: "",
  maxTokens: 1200,
  model: "gpt-4o-mini",
  name: "灵穹 API 网关",
  provider: "new-api",
  systemPrompt:
    "你是战纪宇宙 AI 影视生产线助手。请输出可直接用于影视开发的中文内容，结构清晰，避免虚构真实播放数据、备案号、客户案例。",
  temperature: 0.7
};

const providerLabels: Record<ApiForm["provider"], string> = {
  mock: "本地模拟模型",
  "new-api": "灵穹 API 网关",
  "openai-compatible": "OpenAI 兼容接口"
};

const providerPresets: Record<ApiForm["provider"], Pick<ApiForm, "baseUrl" | "model" | "name" | "provider">> = {
  mock: {
    baseUrl: "local://mock",
    model: "mock-cinema",
    name: "本地模拟模型",
    provider: "mock"
  },
  "new-api": {
    baseUrl: "http://new-api:3000/v1",
    model: "gpt-4o-mini",
    name: "灵穹 API 网关",
    provider: "new-api"
  },
  "openai-compatible": {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    name: "OpenAI 兼容接口",
    provider: "openai-compatible"
  }
};

function Field({
  label,
  multiline = false,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  const className =
    "mt-2 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15";

  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-400">{label}</span>
      {multiline ? (
        <textarea
          className={cn(className, "min-h-28 resize-y leading-6")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      ) : (
        <input
          className={className}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      )}
    </label>
  );
}

export function ModelApiAdmin() {
  const [configs, setConfigs] = useState<PublicModelApiConfig[]>([]);
  const [form, setForm] = useState<ApiForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadConfigs() {
    setLoading(true);
    const response = await fetch("/_wcu-api/admin/model-apis", { cache: "no-store" });

    if (!response.ok) {
      setError("模型 API 配置加载失败。");
      setLoading(false);
      return;
    }

    const result = (await response.json()) as { configs: PublicModelApiConfig[] };
    setConfigs(result.configs);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConfigs();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function editConfig(config: PublicModelApiConfig) {
    setForm({
      apiKey: "",
      baseUrl: config.baseUrl,
      enabled: config.enabled,
      id: config.id,
      maxTokens: config.maxTokens,
      model: config.model,
      name: config.name,
      provider: config.provider,
      systemPrompt: config.systemPrompt,
      temperature: config.temperature
    });
    setMessage(
      config.provider === "new-api"
        ? "正在编辑灵穹 API 模型配置。用户凭证由平台自动关联，无需填写共享 Key。"
        : "正在编辑配置。如不填写 API Key，会保留原 Key。"
    );
    setError("");
  }

  function applyProviderPreset(provider: ApiForm["provider"]) {
    setForm((current) => ({
      ...current,
      ...providerPresets[provider],
      apiKey: provider === current.provider ? current.apiKey : ""
    }));
    setMessage(
      provider === "new-api"
        ? "已切换为灵穹 API 网关：平台会按当前用户自动使用独立凭证。"
        : ""
    );
    setError("");
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/_wcu-api/admin/model-apis", {
      body: JSON.stringify(form),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    setSaving(false);

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
      };
      setError(result?.message ?? "保存失败。");
      return;
    }

    setForm(emptyForm);
    setMessage("模型 API 配置已保存，前台画布生成会优先调用最新启用的配置。");
    await loadConfigs();
  }

  async function deleteConfig(id: string) {
    setError("");
    setMessage("");

    const response = await fetch("/_wcu-api/admin/model-apis", {
      body: JSON.stringify({ id }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE"
    });

    if (!response.ok) {
      setError("删除失败。");
      return;
    }

    setMessage("配置已删除。");
    await loadConfigs();
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035]">
        <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin text-cyan-100" />
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <form
        className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
        onSubmit={saveConfig}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
            <PlugZap aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-stone-50">模型 API 配置</h2>
            <p className="mt-1 text-xs text-stone-500">
              选择可用模型与生成参数；灵穹 API 按用户独立计费。
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2 rounded-lg border border-cyan-200/15 bg-cyan-200/10 p-3">
            <p className="text-xs font-medium text-cyan-50">推荐接入方式</p>
            <p className="text-xs leading-6 text-cyan-50/75">
              本项目已集成灵穹 API。请保存 Base URL、模型名、参数和系统提示词；服务端会通过容器内安全地址，使用当前用户的内部凭证调用。
            </p>
            <div className="flex flex-wrap gap-2">
              {(["new-api", "openai-compatible", "mock"] as ApiForm["provider"][]).map(
                (provider) => (
                  <button
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-medium transition",
                      form.provider === provider
                        ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                        : "border-white/10 bg-black/20 text-stone-300 hover:border-cyan-200/50 hover:text-white"
                    )}
                    key={provider}
                    onClick={() => applyProviderPreset(provider)}
                    type="button"
                  >
                    {providerLabels[provider]}
                  </button>
                )
              )}
            </div>
          </div>

          <Field
            label="配置名称"
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            value={form.name}
          />

          <label className="block">
            <span className="text-xs font-medium text-stone-400">提供方</span>
            <select
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-stone-100 outline-none"
              onChange={(event) =>
                applyProviderPreset(event.target.value as ApiForm["provider"])
              }
              value={form.provider}
            >
              <option value="new-api">灵穹 API 网关</option>
              <option value="openai-compatible">OpenAI 兼容接口</option>
              <option value="mock">本地模拟模型</option>
            </select>
          </label>

          <Field
            label="Base URL"
            onChange={(value) => setForm((current) => ({ ...current, baseUrl: value }))}
            placeholder="https://api.openai.com/v1"
            value={form.baseUrl}
          />

          <Field
            label="模型名"
            onChange={(value) => setForm((current) => ({ ...current, model: value }))}
            placeholder="gpt-4o-mini / deepseek-chat / qwen-plus"
            value={form.model}
          />

          {form.provider === "new-api" ? (
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3">
              <p className="text-xs font-medium text-emerald-100">用户认证：自动隔离</p>
              <p className="mt-1 text-xs leading-6 text-emerald-50/70">
                无需录入共享 API Key。每个已登录用户都会获取独立内部凭证，请求按其自身余额扣费。
              </p>
            </div>
          ) : (
            <Field
              label={form.id ? "API Key（留空则保留原 Key）" : "API Key"}
              onChange={(value) => setForm((current) => ({ ...current, apiKey: value }))}
              placeholder="sk-..."
              type="password"
              value={form.apiKey}
            />
          )}

          <Field
            label="系统提示词"
            multiline
            onChange={(value) =>
              setForm((current) => ({ ...current, systemPrompt: value }))
            }
            value={form.systemPrompt}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Temperature"
              onChange={(value) =>
                setForm((current) => ({ ...current, temperature: Number(value) }))
              }
              type="number"
              value={String(form.temperature)}
            />
            <Field
              label="Max Tokens"
              onChange={(value) =>
                setForm((current) => ({ ...current, maxTokens: Number(value) }))
              }
              type="number"
              value={String(form.maxTokens)}
            />
            <label className="flex items-end gap-3 rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-stone-200">
              <input
                checked={form.enabled}
                className="h-4 w-4 accent-cyan-200"
                onChange={(event) =>
                  setForm((current) => ({ ...current, enabled: event.target.checked }))
                }
                type="checkbox"
              />
              启用
            </label>
          </div>
        </div>

        {message ? (
          <p className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
            <XCircle aria-hidden="true" className="h-4 w-4" />
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="h-4 w-4" />
            )}
            保存 API
          </button>
          <button
            className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
            onClick={() => setForm(emptyForm)}
            type="button"
          >
            新建配置
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold text-stone-50">已配置 API</h2>
        <div className="mt-5 grid gap-3">
          {configs.length ? (
            configs.map((config) => (
              <article
                className="rounded-lg border border-white/10 bg-black/20 p-4"
                key={config.id}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-stone-50">{config.name}</h3>
                      <span
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs",
                          config.enabled
                            ? "border-cyan-200/20 bg-cyan-200/10 text-cyan-50"
                            : "border-white/10 bg-white/[0.04] text-stone-500"
                        )}
                      >
                        {config.enabled ? "启用" : "停用"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-stone-500">
                      {providerLabels[config.provider]} / {config.model}
                    </p>
                    <p className="mt-1 break-all text-xs leading-6 text-stone-500">
                      {config.baseUrl}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-2 text-xs text-stone-400">
                      <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
                      {config.provider === "new-api"
                        ? "按用户自动分配内部凭证"
                        : config.apiKeyPreview}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-stone-100 transition hover:bg-white/10"
                      onClick={() => editConfig(config)}
                      type="button"
                    >
                      编辑
                    </button>
                    <button
                      className="rounded-lg border border-red-300/25 px-3 py-2 text-xs font-medium text-red-100 transition hover:bg-red-400/10"
                      onClick={() => deleteConfig(config.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-stone-400">
              暂无 API 配置。可以先创建一个“本地模拟模型”测试前台调用链路。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
