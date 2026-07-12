"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Layers3,
  Loader2,
  Plus,
  Save,
  Trash2,
  WandSparkles,
  XCircle
} from "lucide-react";

import type {
  SkillModule,
  SkillModuleStatus,
  SkillRun,
  SkillTool,
  UpsertSkillInput
} from "@/lib/skill-workbench";
import { cn } from "@/lib/utils";

type SkillAdminPayload = {
  runs: SkillRun[];
  skills: SkillTool[];
};

type SkillForm = {
  active: boolean;
  category: string;
  description: string;
  displayName: string;
  id: string;
  modules: SkillModule[];
  owner: string;
  triggerName: string;
};

const moduleStatuses: SkillModuleStatus[] = ["可继续生产", "待补材料", "初稿"];
const moduleAccents: SkillModule["accent"][] = ["green", "amber", "blue", "violet", "slate"];

function emptyModule(index = 1): SkillModule {
  return {
    accent: "violet",
    description: "按当前模块规则执行任务。",
    id: `module-${Date.now()}-${index}`,
    materials: ["用户输入", "源文件或素材", "输出要求"],
    nextStep: "继续进入战纪宇宙生产线。",
    order: String(index).padStart(2, "0"),
    outputs: ["结构化结果", "风险提醒", "下一步建议"],
    prompt: "请按这个模块的规则直接执行，并输出可交付结果。",
    reference: "SKILL.md",
    shortTitle: "启动任务",
    status: "可继续生产",
    title: "启动任务"
  };
}

const emptyForm: SkillForm = {
  active: true,
  category: "平台 Skill",
  description: "",
  displayName: "",
  id: "",
  modules: [emptyModule()],
  owner: "平台团队",
  triggerName: ""
};

function fromLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toLines(values: string[]) {
  return values.join("\n");
}

function formFromSkill(skill: SkillTool): SkillForm {
  return {
    active: skill.active,
    category: skill.category,
    description: skill.description,
    displayName: skill.displayName,
    id: skill.id,
    modules: skill.modules.length > 0 ? skill.modules : [emptyModule()],
    owner: skill.owner,
    triggerName: skill.triggerName
  };
}

function Field({
  label,
  multiline = false,
  onChange,
  placeholder,
  value
}: {
  label: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
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
          placeholder={placeholder}
          value={value}
        />
      ) : (
        <input
          className={className}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
      )}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: T) => void;
  options: T[];
  value: T;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-400">{label}</span>
      <select
        className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SkillAdmin() {
  const [skills, setSkills] = useState<SkillTool[]>([]);
  const [runs, setRuns] = useState<SkillRun[]>([]);
  const [form, setForm] = useState<SkillForm>(emptyForm);
  const [selectedModuleId, setSelectedModuleId] = useState(emptyForm.modules[0].id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === form.id) ?? null,
    [form.id, skills]
  );
  const selectedModule = useMemo(
    () => form.modules.find((module) => module.id === selectedModuleId) ?? form.modules[0],
    [form.modules, selectedModuleId]
  );

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/_wcu-api/admin/skills", { cache: "no-store" });
      const data = (await response.json()) as SkillAdminPayload;

      if (!response.ok) {
        throw new Error("Skill 数据读取失败。");
      }

      setSkills(data.skills ?? []);
      setRuns(data.runs ?? []);
      setForm((current) => {
        const next =
          current.id && data.skills?.some((skill) => skill.id === current.id)
            ? current
            : data.skills?.[0]
              ? formFromSkill(data.skills[0])
              : emptyForm;

        setSelectedModuleId(next.modules[0]?.id ?? "");
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Skill 数据读取失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function setSkillForm(next: SkillForm) {
    setForm(next);
    setSelectedModuleId(next.modules[0]?.id ?? "");
  }

  function updateForm(patch: Partial<SkillForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateModule(patch: Partial<SkillModule>) {
    setForm((current) => ({
      ...current,
      modules: current.modules.map((module) =>
        module.id === selectedModule.id ? { ...module, ...patch } : module
      )
    }));
  }

  function addModule() {
    setForm((current) => {
      const nextModule = emptyModule(current.modules.length + 1);
      setSelectedModuleId(nextModule.id);
      return {
        ...current,
        modules: [...current.modules, nextModule]
      };
    });
  }

  function removeModule() {
    if (form.modules.length <= 1) {
      setError("至少保留一个模块。");
      return;
    }

    setForm((current) => {
      const modules = current.modules.filter((module) => module.id !== selectedModule.id);
      setSelectedModuleId(modules[0]?.id ?? "");
      return { ...current, modules };
    });
  }

  async function save() {
    if (!form.displayName.trim()) {
      setError("请填写 Skill 名称。");
      return;
    }

    if (form.modules.length === 0) {
      setError("至少配置一个 Skill 模块。");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload: UpsertSkillInput = {
      active: form.active,
      category: form.category,
      description: form.description,
      displayName: form.displayName,
      id: form.id || undefined,
      modules: form.modules,
      owner: form.owner,
      source: selectedSkill?.source === "内置" ? "内置" : "平台",
      triggerName: form.triggerName,
      visibility: "public"
    };

    try {
      const response = await fetch("/_wcu-api/admin/skills", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Skill 保存失败。");
      }

      setMessage("Skill 已保存。");
      setSkillForm(formFromSkill(result.skill));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill 保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function removeSkill() {
    if (!form.id) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/admin/skills", {
        body: JSON.stringify({ id: form.id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE"
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message ?? "Skill 删除失败。");
      }

      setMessage("Skill 已删除。");
      setSkillForm(emptyForm);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Skill 删除失败。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-5 text-sm text-stone-400">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        正在读取 Skill 工具...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {message ? (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
          <XCircle aria-hidden="true" className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-50">Skill 工具</h2>
              <p className="mt-2 text-sm text-stone-500">
                前台工作台会按分类和模块直接读取这里的配置。
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              onClick={() => setSkillForm({ ...emptyForm, modules: [emptyModule()] })}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              新建
            </button>
          </div>

          <div className="mt-5 grid max-h-[48rem] gap-3 overflow-auto pr-1">
            {skills.map((skill) => (
              <button
                className={cn(
                  "rounded-lg border p-4 text-left transition",
                  form.id === skill.id
                    ? "border-cyan-200 bg-cyan-200/10"
                    : "border-white/10 bg-black/20 hover:border-cyan-200/50"
                )}
                key={skill.id}
                onClick={() => setSkillForm(formFromSkill(skill))}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-50">{skill.displayName}</p>
                    <p className="mt-1 font-mono text-xs text-cyan-100">{skill.triggerName}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-stone-400">
                    {skill.source}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-6 text-stone-500">
                  {skill.description}
                </p>
                <p className="mt-3 text-xs text-stone-500">
                  {skill.category} · {skill.modules.length} 个模块
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center gap-3">
            <WandSparkles aria-hidden="true" className="h-5 w-5 text-cyan-100" />
            <h2 className="text-lg font-semibold text-stone-50">
              {form.id ? "编辑 Skill" : "新建 Skill"}
            </h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field
              label="Skill 名称"
              onChange={(value) => updateForm({ displayName: value })}
              value={form.displayName}
            />
            <Field
              label="触发名"
              onChange={(value) => updateForm({ triggerName: value })}
              placeholder="brand-film-script"
              value={form.triggerName}
            />
            <Field
              label="分类"
              onChange={(value) => updateForm({ category: value })}
              value={form.category}
            />
            <Field
              label="负责人"
              onChange={(value) => updateForm({ owner: value })}
              value={form.owner}
            />
            <div className="md:col-span-2">
              <Field
                label="用途说明"
                multiline
                onChange={(value) => updateForm({ description: value })}
                value={form.description}
              />
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-stone-300">
            <input
              checked={form.active}
              className="h-4 w-4 accent-cyan-200"
              onChange={(event) => updateForm({ active: event.target.checked })}
              type="checkbox"
            />
            前台启用
          </label>

          <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Layers3 aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                <h3 className="text-base font-semibold text-stone-50">模块配置</h3>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                onClick={addModule}
                type="button"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                新增模块
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_1fr]">
              <div className="grid h-fit gap-2">
                {form.modules.map((module) => (
                  <button
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition",
                      selectedModule?.id === module.id
                        ? "border-cyan-200 bg-cyan-200/10"
                        : "border-white/10 bg-zinc-950/70 hover:border-cyan-200/50"
                    )}
                    key={module.id}
                    onClick={() => setSelectedModuleId(module.id)}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-stone-100">
                      {module.order} {module.title}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">{module.status}</p>
                  </button>
                ))}
              </div>

              {selectedModule ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="排序"
                    onChange={(value) => updateModule({ order: value })}
                    value={selectedModule.order}
                  />
                  <Field
                    label="模块标题"
                    onChange={(value) => updateModule({ title: value })}
                    value={selectedModule.title}
                  />
                  <Field
                    label="短标题"
                    onChange={(value) => updateModule({ shortTitle: value })}
                    value={selectedModule.shortTitle}
                  />
                  <Field
                    label="参考文件"
                    onChange={(value) => updateModule({ reference: value })}
                    value={selectedModule.reference}
                  />
                  <SelectField
                    label="状态"
                    onChange={(value) => updateModule({ status: value })}
                    options={moduleStatuses}
                    value={selectedModule.status}
                  />
                  <SelectField
                    label="颜色"
                    onChange={(value) => updateModule({ accent: value })}
                    options={moduleAccents}
                    value={selectedModule.accent}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="模块说明"
                      multiline
                      onChange={(value) => updateModule({ description: value })}
                      value={selectedModule.description}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="执行提示词"
                      multiline
                      onChange={(value) => updateModule({ prompt: value })}
                      value={selectedModule.prompt}
                    />
                  </div>
                  <Field
                    label="所需材料，每行一个"
                    multiline
                    onChange={(value) => updateModule({ materials: fromLines(value) })}
                    value={toLines(selectedModule.materials)}
                  />
                  <Field
                    label="产出项，每行一个"
                    multiline
                    onChange={(value) => updateModule({ outputs: fromLines(value) })}
                    value={toLines(selectedModule.outputs)}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="下一步"
                      onChange={(value) => updateModule({ nextStep: value })}
                      value={selectedModule.nextStep}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-red-300/25 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-300/10"
                      onClick={removeModule}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      删除当前模块
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
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
              保存 Skill
            </button>
            {form.id ? (
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-red-300/25 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-300/10"
                disabled={saving}
                onClick={removeSkill}
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                删除 Skill
              </button>
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold text-stone-50">最近 Skill 运行</h2>
        <div className="mt-4 grid gap-3">
          {runs.length === 0 ? (
            <p className="text-sm text-stone-500">暂无运行记录。</p>
          ) : (
            runs.map((run) => (
              <div
                className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 text-sm md:grid-cols-[1fr_auto]"
                key={run.id}
              >
                <div>
                  <p className="font-semibold text-stone-100">
                    {run.skillName} / {run.moduleTitle}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {run.projectName || "未命名项目"} · {run.model || "未记录模型"} · {run.createdAt}
                  </p>
                  {run.error ? <p className="mt-2 text-xs text-red-100">{run.error}</p> : null}
                </div>
                <span
                  className={cn(
                    "h-fit rounded-full px-3 py-1 text-xs",
                    run.status === "success"
                      ? "bg-emerald-300/10 text-emerald-100"
                      : "bg-red-300/10 text-red-100"
                  )}
                >
                  {run.status === "success" ? "成功" : "失败"}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
