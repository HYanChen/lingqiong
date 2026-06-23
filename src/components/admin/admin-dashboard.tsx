"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database as DatabaseIcon,
  Loader2,
  LogOut,
  Plus,
  Save,
  Trash2,
  XCircle
} from "lucide-react";

import type {
  IconKey,
  PipelineStep,
  Service,
  SiteData,
  UniverseChapter,
  Work
} from "@/content/site";
import { ModelApiAdmin } from "@/components/admin/model-api-admin";
import { defaultSiteData } from "@/content/site";
import { cn } from "@/lib/utils";

type AdminTab =
  | "api"
  | "brand"
  | "database"
  | "services"
  | "universe"
  | "workflow"
  | "works";

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: "brand", label: "品牌与联系" },
  { id: "works", label: "作品" },
  { id: "services", label: "服务" },
  { id: "universe", label: "世界观" },
  { id: "workflow", label: "生产线" },
  { id: "api", label: "API模块" },
  { id: "database", label: "数据库" }
];

type DatabaseStats = {
  counts: {
    frontUsers: number;
    inviteCodes: number;
    modelApiCalls: number;
    modelApis: number;
    projects: number;
    siteContent: number;
  };
  inviteCodes: Array<{
    active: boolean;
    code: string;
    label: string | null;
    updatedAt: string;
    usedCount: number;
  }>;
  path: string;
  recentProjects: Array<{
    createdAt: string;
    id: string;
    name: string;
    ownerAccount: string | null;
    type: string;
  }>;
  recentUsers: Array<{
    account: string;
    contact: string | null;
    createdAt: string;
    id: string;
    inviteCode: string | null;
    profile: string | null;
  }>;
};

const iconOptions: IconKey[] = [
  "BookOpen",
  "Boxes",
  "Building2",
  "Clapperboard",
  "Compass",
  "Film",
  "Flame",
  "Layers3",
  "PenTool",
  "PlaySquare",
  "Radio",
  "ScrollText",
  "ShieldCheck",
  "Sparkles",
  "UsersRound",
  "WandSparkles"
];

function toLines(values: string[]) {
  return values.join("\n");
}

function fromLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  multiline = false,
  onChange,
  type = "text",
  value
}: {
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
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
          className={cn(className, "min-h-24 resize-y leading-6")}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          className={className}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          value={value}
        />
      )}
    </label>
  );
}

function IconSelect({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: IconKey) => void;
  value: IconKey;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-400">{label}</span>
      <select
        className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
        onChange={(event) => onChange(event.target.value as IconKey)}
        value={value}
      >
        {iconOptions.map((icon) => (
          <option key={icon} value={icon}>
            {icon}
          </option>
        ))}
      </select>
    </label>
  );
}

function Card({
  children,
  title,
  onDelete
}: {
  children: ReactNode;
  title: string;
  onDelete?: () => void;
}) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-stone-50">{title}</h2>
        {onDelete ? (
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-red-300/25 px-3 py-2 text-xs font-medium text-red-100 transition hover:bg-red-400/10"
            onClick={onDelete}
            type="button"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            删除
          </button>
        ) : null}
      </div>
      {children}
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 text-sm text-stone-400">
      当前没有内容，可以点击添加按钮创建一项。
    </div>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("brand");
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<SiteData | null>(null);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeLabel = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.label ?? "",
    [activeTab]
  );

  async function loadContent() {
    const response = await fetch("/api/admin/content", { cache: "no-store" });

    if (!response.ok) {
      setData(null);
      return;
    }

    setData((await response.json()) as SiteData);
  }

  async function loadDatabaseStats() {
    const response = await fetch("/api/admin/database", { cache: "no-store" });

    if (!response.ok) {
      setDatabaseStats(null);
      return;
    }

    setDatabaseStats((await response.json()) as DatabaseStats);
  }

  useEffect(() => {
    async function boot() {
      const response = await fetch("/api/admin/me", { cache: "no-store" });
      const result = (await response.json()) as { authenticated: boolean };
      setAuthenticated(result.authenticated);

      if (result.authenticated) {
        await loadContent();
        await loadDatabaseStats();
      }

      setLoading(false);
    }

    void boot();
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      setError("密码不正确。默认本地密码为 zhanji2026，可用 ADMIN_PASSWORD 环境变量修改。");
      return;
    }

    setAuthenticated(true);
    setPassword("");
    await loadContent();
    await loadDatabaseStats();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setData(null);
    setDatabaseStats(null);
  }

  async function save() {
    if (!data) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    setSaving(false);

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
      };
      setError(result?.message ?? "保存失败");
      return;
    }

    setMessage("已保存。刷新前台页面即可看到最新内容。");
    await loadDatabaseStats();
  }

  function resetToDefault() {
    setData(defaultSiteData);
    setMessage("已恢复为默认内容，点击保存后才会写入。");
  }

  function updateWork(index: number, patch: Partial<Work>) {
    setData((current) =>
      current
        ? {
            ...current,
            works: current.works.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            )
          }
        : current
    );
  }

  function updateService(index: number, patch: Partial<Service>) {
    setData((current) =>
      current
        ? {
            ...current,
            services: current.services.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            )
          }
        : current
    );
  }

  function updateChapter(index: number, patch: Partial<UniverseChapter>) {
    setData((current) =>
      current
        ? {
            ...current,
            universeChapters: current.universeChapters.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            )
          }
        : current
    );
  }

  function updateStep(index: number, patch: Partial<PipelineStep>) {
    setData((current) =>
      current
        ? {
            ...current,
            pipelineSteps: current.pipelineSteps.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            )
          }
        : current
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 pt-24">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-cyan-100" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 pt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
          admin
        </p>
        <h1 className="mt-5 text-4xl font-semibold text-stone-50">战纪宇宙后台</h1>
        <p className="mt-4 text-sm leading-7 text-stone-400">
          本地首版后台用于编辑官网内容。默认密码为{" "}
          <span className="font-semibold text-stone-100">zhanji2026</span>，上线前请配置
          ADMIN_PASSWORD。
        </p>
        <form className="mt-8 rounded-lg border border-white/10 bg-white/[0.04] p-5" onSubmit={login}>
          <Field label="后台密码" onChange={setPassword} type="password" value={password} />
          {error ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-red-200">
              <XCircle aria-hidden="true" className="h-4 w-4" />
              {error}
            </p>
          ) : null}
          <button
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
            type="submit"
          >
            登录后台
          </button>
        </form>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mx-auto min-h-screen max-w-4xl px-5 py-32">
        <h1 className="text-3xl font-semibold text-stone-50">后台内容加载失败</h1>
        <button
          className="mt-6 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950"
          onClick={loadContent}
          type="button"
        >
          重新加载
        </button>
      </section>
    );
  }

  return (
    <section className="min-h-screen px-5 pb-20 pt-28 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
              content admin
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-stone-50 md:text-6xl">
              战纪宇宙后台
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-400">
              当前编辑：{activeLabel}。保存后会写入本地 SQLite 数据库，前台刷新即可读取。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              onClick={resetToDefault}
              type="button"
            >
              恢复默认
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              onClick={logout}
              type="button"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              退出
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={save}
              type="button"
            >
              {saving ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4" />
              )}
              保存
            </button>
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

        <div className="mt-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              className={cn(
                "rounded-lg border px-4 py-2 text-sm transition",
                activeTab === tab.id
                  ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                  : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-cyan-200/50 hover:text-white"
              )}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {activeTab === "brand" ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="品牌">
                <div className="grid gap-4">
                  <Field
                    label="品牌名"
                    onChange={(value) =>
                      setData({ ...data, brand: { ...data.brand, name: value } })
                    }
                    value={data.brand.name}
                  />
                  <Field
                    label="英文名"
                    onChange={(value) =>
                      setData({ ...data, brand: { ...data.brand, english: value } })
                    }
                    value={data.brand.english}
                  />
                  <Field
                    label="首页副标题"
                    onChange={(value) =>
                      setData({ ...data, brand: { ...data.brand, tagline: value } })
                    }
                    value={data.brand.tagline}
                  />
                  <Field
                    label="品牌简介"
                    multiline
                    onChange={(value) =>
                      setData({ ...data, brand: { ...data.brand, description: value } })
                    }
                    value={data.brand.description}
                  />
                </div>
              </Card>
              <Card title="公司与联系">
                <div className="grid gap-4">
                  <Field
                    label="公司简称"
                    onChange={(value) =>
                      setData({ ...data, company: { ...data.company, name: value } })
                    }
                    value={data.company.name}
                  />
                  <Field
                    label="公司全称"
                    onChange={(value) =>
                      setData({ ...data, company: { ...data.company, legalName: value } })
                    }
                    value={data.company.legalName}
                  />
                  <Field
                    label="公司角色"
                    onChange={(value) =>
                      setData({ ...data, company: { ...data.company, role: value } })
                    }
                    value={data.company.role}
                  />
                  <Field
                    label="邮箱"
                    onChange={(value) =>
                      setData({
                        ...data,
                        company: {
                          ...data.company,
                          contact: { ...data.company.contact, email: value }
                        }
                      })
                    }
                    value={data.company.contact.email}
                  />
                  <Field
                    label="电话"
                    onChange={(value) =>
                      setData({
                        ...data,
                        company: {
                          ...data.company,
                          contact: { ...data.company.contact, phone: value }
                        }
                      })
                    }
                    value={data.company.contact.phone}
                  />
                  <Field
                    label="微信"
                    onChange={(value) =>
                      setData({
                        ...data,
                        company: {
                          ...data.company,
                          contact: { ...data.company.contact, wechat: value }
                        }
                      })
                    }
                    value={data.company.contact.wechat}
                  />
                  <Field
                    label="首页四个卖点，每行一个"
                    multiline
                    onChange={(value) => setData({ ...data, proofPoints: fromLines(value) })}
                    value={toLines(data.proofPoints)}
                  />
                </div>
              </Card>
            </div>
          ) : null}

          {activeTab === "works" ? (
            <div className="space-y-5">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                onClick={() =>
                  setData({
                    ...data,
                    works: [
                      ...data.works,
                      {
                        slug: `new-work-${data.works.length + 1}`,
                        title: "新作品",
                        category: "战纪宇宙",
                        status: "概念展示",
                        format: "概念样片",
                        logline: "这里填写作品一句话介绍。",
                        image: data.media.spark,
                        tags: ["待补充"],
                        deliverables: ["待补充"]
                      }
                    ]
                  })
                }
                type="button"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                添加作品
              </button>
              {data.works.length ? (
                data.works.map((work, index) => (
                  <Card
                    key={`${work.slug}-${index}`}
                    onDelete={() =>
                      setData({
                        ...data,
                        works: data.works.filter((_, itemIndex) => itemIndex !== index)
                      })
                    }
                    title={work.title || `作品 ${index + 1}`}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="slug" onChange={(value) => updateWork(index, { slug: value })} value={work.slug} />
                      <Field label="标题" onChange={(value) => updateWork(index, { title: value })} value={work.title} />
                      <Field label="分类" onChange={(value) => updateWork(index, { category: value })} value={work.category} />
                      <Field label="状态" onChange={(value) => updateWork(index, { status: value })} value={work.status} />
                      <Field label="形态" onChange={(value) => updateWork(index, { format: value })} value={work.format} />
                      <Field label="图片路径" onChange={(value) => updateWork(index, { image: value })} value={work.image} />
                      <Field label="一句话介绍" multiline onChange={(value) => updateWork(index, { logline: value })} value={work.logline} />
                      <Field label="标签，每行一个" multiline onChange={(value) => updateWork(index, { tags: fromLines(value) })} value={toLines(work.tags)} />
                      <Field label="交付物，每行一个" multiline onChange={(value) => updateWork(index, { deliverables: fromLines(value) })} value={toLines(work.deliverables)} />
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          ) : null}

          {activeTab === "services" ? (
            <div className="space-y-5">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                onClick={() =>
                  setData({
                    ...data,
                    services: [
                      ...data.services,
                      {
                        title: "新服务",
                        audience: "目标客户",
                        summary: "服务说明",
                        timeline: "待定",
                        deliverables: ["待补充"],
                        icon: "Sparkles"
                      }
                    ]
                  })
                }
                type="button"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                添加服务
              </button>
              {data.services.length ? (
                data.services.map((service, index) => (
                  <Card
                    key={`${service.title}-${index}`}
                    onDelete={() =>
                      setData({
                        ...data,
                        services: data.services.filter((_, itemIndex) => itemIndex !== index)
                      })
                    }
                    title={service.title || `服务 ${index + 1}`}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="标题" onChange={(value) => updateService(index, { title: value })} value={service.title} />
                      <Field label="目标客户" onChange={(value) => updateService(index, { audience: value })} value={service.audience} />
                      <Field label="周期" onChange={(value) => updateService(index, { timeline: value })} value={service.timeline} />
                      <IconSelect label="图标" onChange={(value) => updateService(index, { icon: value })} value={service.icon} />
                      <Field label="服务说明" multiline onChange={(value) => updateService(index, { summary: value })} value={service.summary} />
                      <Field label="交付物，每行一个" multiline onChange={(value) => updateService(index, { deliverables: fromLines(value) })} value={toLines(service.deliverables)} />
                    </div>
                  </Card>
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          ) : null}

          {activeTab === "universe" ? (
            <div className="space-y-5">
              {data.universeChapters.map((chapter, index) => (
                <Card key={`${chapter.title}-${index}`} title={chapter.title || `章节 ${index + 1}`}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="标题" onChange={(value) => updateChapter(index, { title: value })} value={chapter.title} />
                    <Field label="阶段" onChange={(value) => updateChapter(index, { period: value })} value={chapter.period} />
                    <IconSelect label="图标" onChange={(value) => updateChapter(index, { icon: value })} value={chapter.icon} />
                    <Field label="说明" multiline onChange={(value) => updateChapter(index, { summary: value })} value={chapter.summary} />
                  </div>
                </Card>
              ))}
            </div>
          ) : null}

          {activeTab === "workflow" ? (
            <div className="space-y-5">
              {data.pipelineSteps.map((step, index) => (
                <Card key={`${step.eyebrow}-${step.title}`} title={`${step.eyebrow} ${step.title}`}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="序号" onChange={(value) => updateStep(index, { eyebrow: value })} value={step.eyebrow} />
                    <Field label="标题" onChange={(value) => updateStep(index, { title: value })} value={step.title} />
                    <IconSelect label="图标" onChange={(value) => updateStep(index, { icon: value })} value={step.icon} />
                    <Field label="产物" onChange={(value) => updateStep(index, { output: value })} value={step.output} />
                    <Field label="说明" multiline onChange={(value) => updateStep(index, { summary: value })} value={step.summary} />
                  </div>
                </Card>
              ))}
            </div>
          ) : null}

          {activeTab === "api" ? <ModelApiAdmin /> : null}

          {activeTab === "database" ? (
            <div className="space-y-5">
              <Card title="数据库状态">
                {databaseStats ? (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3 rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-4">
                      <DatabaseIcon
                        aria-hidden="true"
                        className="mt-0.5 h-5 w-5 shrink-0 text-cyan-100"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-cyan-50">
                          本地 SQLite 已启用
                        </p>
                        <p className="mt-2 break-all text-xs leading-6 text-stone-400">
                          {databaseStats.path}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ["官网内容", databaseStats.counts.siteContent],
                        ["邀请码", databaseStats.counts.inviteCodes],
                        ["注册用户", databaseStats.counts.frontUsers],
                        ["创作项目", databaseStats.counts.projects],
                        ["模型 API", databaseStats.counts.modelApis],
                        ["模型调用", databaseStats.counts.modelApiCalls]
                      ].map(([label, value]) => (
                        <div
                          className="rounded-lg border border-white/10 bg-black/20 p-4"
                          key={label}
                        >
                          <p className="text-xs text-stone-500">{label}</p>
                          <p className="mt-2 text-2xl font-semibold text-stone-50">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    className="rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950"
                    onClick={loadDatabaseStats}
                    type="button"
                  >
                    重新读取数据库
                  </button>
                )}
              </Card>

              {databaseStats ? (
                <div className="grid gap-5 xl:grid-cols-3">
                  <Card title="邀请码">
                    <div className="space-y-3">
                      {databaseStats.inviteCodes.map((item) => (
                        <div
                          className="rounded-lg border border-white/10 bg-black/20 p-4"
                          key={item.code}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-sm text-stone-100">{item.code}</p>
                            <span className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-xs text-cyan-50">
                              {item.active ? "启用" : "停用"}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-stone-500">
                            使用 {item.usedCount} 次
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card title="最近注册">
                    <div className="space-y-3">
                      {databaseStats.recentUsers.length ? (
                        databaseStats.recentUsers.map((item) => (
                          <div
                            className="rounded-lg border border-white/10 bg-black/20 p-4"
                            key={item.id}
                          >
                            <p className="text-sm font-semibold text-stone-100">
                              {item.account}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-stone-500">
                              {item.profile ?? "未填写身份"} /{" "}
                              {item.inviteCode ?? "无邀请码"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <EmptyState />
                      )}
                    </div>
                  </Card>

                  <Card title="最近项目">
                    <div className="space-y-3">
                      {databaseStats.recentProjects.length ? (
                        databaseStats.recentProjects.map((item) => (
                          <div
                            className="rounded-lg border border-white/10 bg-black/20 p-4"
                            key={item.id}
                          >
                            <p className="text-sm font-semibold text-stone-100">
                              {item.name}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-stone-500">
                              {item.type} / {item.ownerAccount ?? "未绑定用户"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <EmptyState />
                      )}
                    </div>
                  </Card>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
