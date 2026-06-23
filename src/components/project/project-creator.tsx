"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  Clapperboard,
  FileText,
  Film,
  Loader2,
  Sparkles
} from "lucide-react";

import { readFrontUser } from "@/lib/front-auth";
import { cn } from "@/lib/utils";

const projectTypes = [
  "战纪宇宙",
  "短剧漫剧",
  "概念预告",
  "文旅宣传",
  "品牌影像"
];

const deliverableOptions = [
  "影视大纲",
  "剧本",
  "角色资产库",
  "场景资产库",
  "分镜",
  "全能提示词",
  "视频样片"
];

export type CanvasProject = {
  id?: string;
  name: string;
  type: string;
  source: string;
  goal: string;
  style: string;
  deliverables: string[];
  createdAt: string;
};

const storageKey = "wcu_current_project";

export function saveCanvasProject(project: CanvasProject) {
  window.localStorage.setItem(storageKey, JSON.stringify(project));
}

export function readCanvasProject(): CanvasProject | null {
  const raw = window.localStorage.getItem(storageKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CanvasProject;
  } catch {
    return null;
  }
}

export function ProjectCreator() {
  const router = useRouter();
  const [type, setType] = useState(projectTypes[0]);
  const [name, setName] = useState("战纪宇宙001：《火种》");
  const [source, setSource] = useState(
    "旧军功章、战地日记、后代入伍选择，做成第一支概念样片。"
  );
  const [goal, setGoal] = useState("生成可展示、可招商、可继续扩展的 AI 影视项目母档。");
  const [style, setStyle] = useState("电影感、厚重、真实质感、克制热血、AI 影像工业化。");
  const [deliverables, setDeliverables] = useState([
    "影视大纲",
    "角色资产库",
    "分镜",
    "全能提示词"
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(
    () => [
      ["项目类型", type],
      ["项目名称", name || "未命名项目"],
      ["交付目标", `${deliverables.length} 项产物`]
    ],
    [deliverables.length, name, type]
  );

  function toggleDeliverable(option: string) {
    setDeliverables((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    const localProject = {
      name: name || "未命名项目",
      type,
      source,
      goal,
      style,
      deliverables,
      createdAt: new Date().toISOString()
    };

    saveCanvasProject(localProject);

    try {
      const user = readFrontUser();
      const response = await fetch("/api/projects", {
        body: JSON.stringify({
          ...localProject,
          ownerAccount: user?.account,
          ownerId: user?.id
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
        ok: boolean;
        project?: CanvasProject;
      };

      if (!response.ok || !result?.project) {
        setError(result?.message ?? "项目保存到数据库失败。");
        setSaving(false);
        return;
      }

      saveCanvasProject(result.project);
      router.push(`/canvas?project=${result.project.id}`);
    } catch {
      setError("项目保存到数据库失败，请稍后重试。");
      setSaving(false);
    }
  }

  return (
    <section className="min-h-screen bg-[#050505] px-5 pb-20 pt-28 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-6 lg:sticky lg:top-28 lg:h-fit">
            <p className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Project Create
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold text-stone-50 md:text-5xl">
              创建项目
            </h1>
            <p className="mt-4 text-sm leading-7 text-stone-400">
              先把项目类型、素材来源、目标产物和视觉风格定下来，然后进入影视画布继续拆资产、分镜和提示词。
            </p>
            <div className="mt-8 grid gap-3">
              {summary.map(([label, value]) => (
                <div
                  className="rounded-lg border border-white/10 bg-black/24 px-4 py-3"
                  key={label}
                >
                  <p className="text-xs text-stone-500">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-stone-100">{value}</p>
                </div>
              ))}
            </div>
          </aside>

          <form
            className="rounded-lg border border-white/10 bg-white/[0.035] p-5 md:p-7"
            onSubmit={submit}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                step 01
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-stone-50">
                选择项目类型
              </h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {projectTypes.map((item) => (
                  <button
                    className={cn(
                      "rounded-lg border px-4 py-2 text-sm transition",
                      type === item
                        ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                        : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-cyan-200/50 hover:text-white"
                    )}
                    key={item}
                    onClick={() => setType(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-5">
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <Film aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  项目名称
                </span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <FileText aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  素材 / 故事来源
                </span>
                <textarea
                  className="mt-2 min-h-28 w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm leading-7 text-stone-100 outline-none transition focus:border-cyan-200/70"
                  onChange={(event) => setSource(event.target.value)}
                  value={source}
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <Clapperboard aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  制作目标
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm leading-7 text-stone-100 outline-none transition focus:border-cyan-200/70"
                  onChange={(event) => setGoal(event.target.value)}
                  value={goal}
                />
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <Boxes aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  视觉风格
                </span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70"
                  onChange={(event) => setStyle(event.target.value)}
                  value={style}
                />
              </label>
            </div>

            <div className="mt-8">
              <p className="text-sm font-medium text-stone-300">需要生成的项目产物</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {deliverableOptions.map((option) => (
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition",
                      deliverables.includes(option)
                        ? "border-cyan-200/60 bg-cyan-200/10 text-cyan-50"
                        : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25"
                    )}
                    key={option}
                  >
                    <input
                      checked={deliverables.includes(option)}
                      className="h-4 w-4 accent-cyan-200"
                      onChange={() => toggleDeliverable(option)}
                      type="checkbox"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {error ? (
                <p className="basis-full rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </p>
              ) : null}
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                disabled={saving}
                type="submit"
              >
                {saving ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                )}
                {saving ? "正在写入数据库" : "创建项目并进入画布"}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                onClick={() => router.push("/canvas")}
                type="button"
              >
                跳过，直接进画布
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
