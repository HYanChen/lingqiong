"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Clapperboard,
  FileText,
  Film,
  Frame,
  Loader2,
  Sparkles
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const projectTypes = ["战纪宇宙", "短剧漫剧", "概念预告", "文旅宣传", "品牌影像"];
const deliverableOptions = ["影视大纲", "剧本", "角色资产库", "场景资产库", "分镜", "全能提示词", "视频样片"];
const aspectRatioOptions = [
  { label: "横屏", value: "16:9" },
  { label: "竖屏", value: "9:16" },
  { label: "标准", value: "4:3" },
  { label: "纵向", value: "3:4" },
  { label: "方形", value: "1:1" },
  { label: "电影", value: "21:9" }
] as const;

type CreatedProject = {
  id?: string;
  name: string;
};

export function ProjectCreatePage() {
  const router = useRouter();
  const [type, setType] = useState(projectTypes[0]);
  const [name, setName] = useState("战纪宇宙001：《火种》");
  const [source, setSource] = useState("旧军功章、战地日记、后代入伍选择，做成第一支概念样片。");
  const [goal, setGoal] = useState("生成可展示、可招商、可继续扩展的 AI 影视项目母档。");
  const [style, setStyle] = useState("电影感、厚重、真实质感、克制热血、AI 影像工业化。");
  const [aspectRatio, setAspectRatio] = useState<(typeof aspectRatioOptions)[number]["value"]>("9:16");
  const [deliverables, setDeliverables] = useState(["影视大纲", "角色资产库", "分镜", "全能提示词"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(() => [
    ["项目类型", type],
    ["项目名称", name.trim() || "未命名项目"],
    ["画面比例", aspectRatio],
    ["交付目标", `${deliverables.length} 项产物`]
  ], [aspectRatio, deliverables.length, name, type]);

  function toggleDeliverable(option: string) {
    setDeliverables((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("请填写项目名称。");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/_wcu-api/projects", {
        body: JSON.stringify({
          aspectRatio,
          deliverables,
          goal,
          name: name.trim(),
          source,
          style,
          type
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string; ok?: boolean; project?: CreatedProject }
        | null;
      if (response.status === 401) {
        window.location.assign("/login?next=/create");
        return;
      }
      if (!response.ok || !result?.ok || !result.project?.id) {
        throw new Error(result?.message || "项目创建失败。");
      }
      router.push(`/projects/${encodeURIComponent(result.project.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "项目创建失败，请稍后重试。");
      setSaving(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-128px)] bg-[radial-gradient(circle_at_85%_0%,rgba(18,114,119,0.12),transparent_28%),#050505] px-5 pb-20 pt-10 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link className="inline-flex items-center gap-2 text-sm text-stone-400 transition hover:text-cyan-100" href="/projects"><ArrowLeft className="h-4 w-4" />返回我的项目</Link>
        </div>
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.035] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.18)] lg:sticky lg:top-36">
            <p className="inline-flex items-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100"><Sparkles className="h-4 w-4" />Project Create</p>
            <h1 className="mt-5 text-balance text-4xl font-semibold text-stone-50 md:text-5xl">创建项目</h1>
            <p className="mt-4 text-sm leading-7 text-stone-400">先确定项目类型、素材来源、制作目标、视觉风格和交付产物，创建后直接进入项目生产工作台。</p>
            <div className="mt-8 grid gap-3">{summary.map(([label, value]) => <div className="rounded-lg border border-white/10 bg-black/25 px-4 py-3" key={label}><p className="text-xs text-stone-500">{label}</p><p className="mt-2 break-words text-sm font-semibold text-stone-100">{value}</p></div>)}</div>
          </aside>

          <form className="rounded-lg border border-white/10 bg-white/[0.035] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.22)] md:p-7" onSubmit={submit}>
            <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">step 01</p><h2 className="mt-3 text-2xl font-semibold text-stone-50">选择项目类型</h2><div className="mt-5 flex flex-wrap gap-2">{projectTypes.map((item) => <button aria-pressed={type === item} className={cn("rounded-lg border px-4 py-2 text-sm transition", type === item ? "border-cyan-200 bg-cyan-200 text-zinc-950" : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-cyan-200/50 hover:text-white")} key={item} onClick={() => setType(item)} type="button">{item}</button>)}</div></div>

            <div className="mt-8 grid gap-5">
              <label className="block"><span className="flex items-center gap-2 text-sm font-medium text-stone-300"><Film className="h-4 w-4 text-cyan-100" />项目名称 <em className="not-italic text-red-300">*</em></span><input autoFocus className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-zinc-950/60 px-4 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70" maxLength={255} onChange={(event) => { setName(event.target.value); if (error) setError(""); }} required value={name} /></label>
              <label className="block"><span className="flex items-center gap-2 text-sm font-medium text-stone-300"><FileText className="h-4 w-4 text-cyan-100" />素材 / 故事来源</span><textarea className="mt-2 min-h-28 w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm leading-7 text-stone-100 outline-none transition focus:border-cyan-200/70" maxLength={300000} onChange={(event) => setSource(event.target.value)} value={source} /></label>
              <label className="block"><span className="flex items-center gap-2 text-sm font-medium text-stone-300"><Clapperboard className="h-4 w-4 text-cyan-100" />制作目标</span><textarea className="mt-2 min-h-24 w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm leading-7 text-stone-100 outline-none transition focus:border-cyan-200/70" maxLength={50000} onChange={(event) => setGoal(event.target.value)} value={goal} /></label>
              <label className="block"><span className="flex items-center gap-2 text-sm font-medium text-stone-300"><Boxes className="h-4 w-4 text-cyan-100" />视觉风格</span><textarea className="mt-2 min-h-24 w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3 text-sm leading-7 text-stone-100 outline-none transition focus:border-cyan-200/70" maxLength={50000} onChange={(event) => setStyle(event.target.value)} value={style} /></label>
            </div>

            <div className="mt-8"><p className="flex items-center gap-2 text-sm font-medium text-stone-300"><Frame className="h-4 w-4 text-cyan-100" />画面比例</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{aspectRatioOptions.map((option) => <button aria-pressed={aspectRatio === option.value} className={cn("rounded-lg border px-4 py-3 text-left transition", aspectRatio === option.value ? "border-cyan-200/70 bg-cyan-200/12 text-cyan-50" : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25")} key={option.value} onClick={() => setAspectRatio(option.value)} type="button"><strong className="block text-sm">{option.value}</strong><span className="mt-1 block text-xs opacity-65">{option.label}</span></button>)}</div></div>

            <div className="mt-8"><p className="text-sm font-medium text-stone-300">需要生成的项目产物</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{deliverableOptions.map((option) => <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition", deliverables.includes(option) ? "border-cyan-200/60 bg-cyan-200/10 text-cyan-50" : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/25")} key={option}><input checked={deliverables.includes(option)} className="h-4 w-4 accent-cyan-200" onChange={() => toggleDeliverable(option)} type="checkbox" />{option}</label>)}</div></div>

            <div className="mt-8 flex flex-wrap items-center gap-3">{error ? <p className="basis-full rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}<button className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || !name.trim()} type="submit">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{saving ? "正在创建项目" : "创建项目并进入项目"}</button><Link className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10" href="/projects">取消</Link></div>
          </form>
        </div>
      </div>
    </section>
  );
}
