"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clipboard,
  Download,
  FileCheck2,
  FileInput,
  FileText,
  Film,
  FolderKanban,
  History,
  Layers3,
  LibraryBig,
  Loader2,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  SkillModelStatus,
  SkillRun,
  SkillTool
} from "@/lib/skill-workbench";
import type { StoredProject } from "@/lib/projects";
import { cn } from "@/lib/utils";

type SkillResponse = {
  message?: string;
  modelStatus?: SkillModelStatus;
  ok?: boolean;
  skills?: SkillTool[];
};

type ProjectResponse = {
  message?: string;
  ok?: boolean;
  project?: StoredProject;
  projects?: StoredProject[];
};

type AccountResponse = {
  apiAccount?: {
    balance?: number | string;
    balanceLabel?: string;
    quota?: number | string;
  } | null;
  connected?: boolean;
  message?: string;
  modelAccess?: {
    allowed: boolean;
    code: string;
    message: string;
  };
  ok?: boolean;
  rechargeUrl?: string;
};

type RunResponse = {
  message?: string;
  ok?: boolean;
  rechargeUrl?: string;
  run?: SkillRun;
};

type ScriptUploadResponse = {
  message?: string;
  ok?: boolean;
  upload?: Omit<UploadedScript, "status">;
};

type UploadedScript = {
  characterCount: number;
  content: string;
  extension: string;
  id: string;
  includedCharacterCount: number;
  message?: string;
  name: string;
  path: string;
  size: number;
  status: "error" | "ready" | "uploading";
  truncated: boolean;
  warnings: string[];
};

type GoalId = "new-story" | "improve-script" | "visual-production" | "solve-blocker";
type ViewId = "start" | "library" | "history";

type Goal = {
  description: string;
  icon: typeof Sparkles;
  id: GoalId;
  keywords: string[];
  label: string;
  moduleKeywords: string[];
  preferredSkillIds: string[];
  prompt: string;
};

const goals: Goal[] = [
  {
    description: "从一句话灵感建立项目档案、故事大纲和人物关系。",
    icon: WandSparkles,
    id: "new-story",
    keywords: ["剧本", "项目开发", "生产总控"],
    label: "从一个故事开始",
    moduleKeywords: ["从0到1", "项目开发", "故事大纲"],
    preferredSkillIds: ["script-writing-studio", "wcu-production-command"],
    prompt: "我有一个故事灵感，希望先形成可生产的项目方案。"
  },
  {
    description: "诊断现有剧本、优化节奏、人物动机和台词。",
    icon: BookOpenText,
    id: "improve-script",
    keywords: ["剧本", "会诊", "台词"],
    label: "完善现有剧本",
    moduleKeywords: ["诊断已有剧本", "剧本会诊", "台词精修"],
    preferredSkillIds: ["script-writing-studio"],
    prompt: "请基于我提供的剧本先诊断，再给出明确的修改范围。"
  },
  {
    description: "继续制作角色资产、分镜、提示词与视频镜头。",
    icon: Film,
    id: "visual-production",
    keywords: ["资产", "分镜", "提示词"],
    label: "推进视觉制作",
    moduleKeywords: ["10秒分镜", "导演故事板", "AI 视频分镜", "资产库抽取"],
    preferredSkillIds: ["wcu-director-board", "wcu-asset-factory", "wcu-prompt-router"],
    prompt: "请把现有项目继续推进到可执行的视觉资产或分镜成果。"
  },
  {
    description: "让制片总控识别当前卡点，并给出下一步执行清单。",
    icon: MessageSquareText,
    id: "solve-blocker",
    keywords: ["生产总控", "知识", "体检"],
    label: "解决当前卡点",
    moduleKeywords: ["缺口体检", "生产体检", "总控拆解"],
    preferredSkillIds: ["wcu-production-command"],
    prompt: "我在项目推进中遇到卡点，请先判断缺口并给出可立即执行的下一步。"
  }
];

const emptyModelStatus: SkillModelStatus = {
  baseUrl: null,
  configured: false,
  hasToken: false,
  message: "正在检查灵穹 API",
  model: null,
  name: null
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function balanceText(account?: AccountResponse["apiAccount"]) {
  if (!account) return "未连接";
  const value = account.balanceLabel ?? account.balance ?? account.quota;
  if (typeof value === "number") return value.toLocaleString("zh-CN");
  return typeof value === "string" && value.trim() ? value : "0";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function skillGoalScore(skill: SkillTool, goal: Goal) {
  const preferredIndex = goal.preferredSkillIds.indexOf(skill.id);
  const haystack = [
    skill.displayName,
    skill.category,
    skill.description,
    ...skill.modules.flatMap((module) => [module.title, module.shortTitle, module.description])
  ].join(" ");
  const keywordScore = goal.keywords.reduce(
    (score, keyword) => score + (haystack.includes(keyword) ? 1 : 0),
    0
  );

  return (preferredIndex >= 0 ? 100 - preferredIndex : 0) + keywordScore;
}

function rankSkillsForGoal(skills: SkillTool[], goal: Goal) {
  return skills
    .map((skill, index) => ({ index, score: skillGoalScore(skill, goal), skill }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ skill }) => skill);
}

function moduleForGoal(skill: SkillTool, goal: Goal) {
  return (
    skill.modules.find((module) => {
      const haystack = [module.title, module.shortTitle, module.description].join(" ");
      return goal.moduleKeywords.some((keyword) => haystack.includes(keyword));
    }) ?? skill.modules[0]
  );
}

function StepBadge({ active, complete, number }: { active: boolean; complete: boolean; number: number }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition",
        complete && "border-emerald-300/40 bg-emerald-300/15 text-emerald-100",
        active && !complete && "border-cyan-200/50 bg-cyan-200/15 text-cyan-50",
        !active && !complete && "border-white/10 bg-white/[0.025] text-stone-500"
      )}
    >
      {complete ? <Check className="h-4 w-4" /> : number}
    </span>
  );
}

function SectionHeading({
  active,
  complete,
  description,
  number,
  title
}: {
  active: boolean;
  complete: boolean;
  description: string;
  number: number;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <StepBadge active={active} complete={complete} number={number} />
      <div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
      </div>
    </div>
  );
}

async function readJson<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}

export function UserSkillWorkbench() {
  const [view, setView] = useState<ViewId>("start");
  const [skills, setSkills] = useState<SkillTool[]>([]);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [modelStatus, setModelStatus] = useState<SkillModelStatus>(emptyModelStatus);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rechargeUrl, setRechargeUrl] = useState("/account/billing");
  const [goalId, setGoalId] = useState<GoalId | "">("");
  const [projectChoice, setProjectChoice] = useState("new");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [userInput, setUserInput] = useState("");
  const [executionDepth, setExecutionDepth] = useState("完整执行");
  const [outputFormat, setOutputFormat] = useState("结构化正文");
  const [runs, setRuns] = useState<SkillRun[]>([]);
  const [category, setCategory] = useState("全部");
  const [uploadedScripts, setUploadedScripts] = useState<UploadedScript[]>([]);
  const [removingScriptIds, setRemovingScriptIds] = useState<string[]>([]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    const [skillResult, projectResult, accountResult] = await Promise.allSettled([
      fetch("/_wcu-api/skills", { cache: "no-store" }),
      fetch("/_wcu-api/projects?limit=50", { cache: "no-store" }),
      fetch("/_wcu-api/account/overview", { cache: "no-store" })
    ]);

    try {
      if (skillResult.status !== "fulfilled") throw new Error("Skill 列表读取失败。");
      const skillData = await readJson<SkillResponse>(skillResult.value);
      if (!skillResult.value.ok || !skillData.ok) throw new Error(skillData.message || "Skill 列表读取失败。");
      setSkills(skillData.skills ?? []);
      setModelStatus(skillData.modelStatus ?? emptyModelStatus);

      if (projectResult.status === "fulfilled") {
        const projectData = await readJson<ProjectResponse>(projectResult.value);
        if (projectResult.value.ok && projectData.ok) {
          const nextProjects = projectData.projects ?? [];
          setProjects(nextProjects);
          if (nextProjects[0]) setProjectChoice((current) => (current === "new" ? nextProjects[0].id : current));
        }
      }

      if (accountResult.status === "fulfilled") {
        const accountData = await readJson<AccountResponse>(accountResult.value);
        setAccount(accountData);
        setRechargeUrl(accountData.rechargeUrl || "/account/billing");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Skill 工作台加载失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadWorkspace();
    });
    return () => {
      cancelled = true;
    };
  }, [loadWorkspace]);

  const selectedGoal = goals.find((goal) => goal.id === goalId);
  const recommendedSkills = useMemo(() => {
    if (!selectedGoal) return skills;
    return rankSkillsForGoal(skills, selectedGoal);
  }, [selectedGoal, skills]);
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId);
  const selectedModule = selectedSkill?.modules.find((module) => module.id === selectedModuleId);
  const selectedProject = projects.find((project) => project.id === projectChoice);
  const selectedProjectName = projectChoice === "new" ? newProjectName.trim() : selectedProject?.name ?? "";
  const readyScripts = uploadedScripts.filter((script) => script.status === "ready");
  const combinedUserInput = [
    userInput.trim(),
    ...readyScripts.map(
      (script) =>
        `【上传剧本：${script.name}】\n${script.content}`
    )
  ]
    .filter(Boolean)
    .join("\n\n");
  const canRun = Boolean(
    goalId && selectedSkill && selectedModule && selectedProjectName && combinedUserInput
  );
  const modelAllowed = Boolean(
    modelStatus.configured &&
      modelStatus.hasToken &&
      account?.connected &&
      account?.modelAccess?.allowed
  );
  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(skills.map((skill) => skill.category)))],
    [skills]
  );
  const visibleSkills = category === "全部" ? skills : skills.filter((skill) => skill.category === category);

  function chooseGoal(goal: Goal) {
    setGoalId(goal.id);
    setUserInput((current) => current || goal.prompt);
    const recommendation = rankSkillsForGoal(skills, goal)[0];
    if (recommendation) {
      setSelectedSkillId(recommendation.id);
      setSelectedModuleId(moduleForGoal(recommendation, goal)?.id ?? "");
    }
    setError("");
  }

  function chooseSkill(skill: SkillTool) {
    setSelectedSkillId(skill.id);
    setSelectedModuleId(skill.modules[0]?.id ?? "");
  }

  async function uploadScriptFiles(files: File[]) {
    if (!files.length) return;

    setError("");
    setNotice("");
    let uploadedCount = 0;
    let failedCount = 0;

    for (const file of files) {
      const pendingId = crypto.randomUUID();
      const pending: UploadedScript = {
        characterCount: 0,
        content: "",
        extension: file.name.split(".").pop()?.toLowerCase() ?? "",
        id: pendingId,
        includedCharacterCount: 0,
        name: file.name,
        path: "",
        size: file.size,
        status: "uploading",
        truncated: false,
        warnings: []
      };

      setUploadedScripts((current) => [...current, pending]);

      try {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/_wcu-api/skills/script-upload", {
          body: form,
          method: "POST"
        });
        const result = await readJson<ScriptUploadResponse>(response);

        if (!response.ok || !result.ok || !result.upload) {
          throw new Error(result.message || `${file.name} 上传失败。`);
        }

        const uploaded: UploadedScript = { ...result.upload, status: "ready" };
        setUploadedScripts((current) =>
          current.map((item) => (item.id === pendingId ? uploaded : item))
        );
        uploadedCount += 1;
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : `${file.name} 上传失败。`;
        setUploadedScripts((current) =>
          current.map((item) =>
            item.id === pendingId ? { ...item, message, status: "error" } : item
          )
        );
        failedCount += 1;
      }
    }

    if (uploadedCount) {
      setNotice(`已读取 ${uploadedCount} 个剧本文件，执行任务时会自动带入正文。`);
    }
    if (failedCount) {
      setError(`${failedCount} 个文件未能读取，请查看文件状态后重试。`);
    }
  }

  async function removeUploadedScript(script: UploadedScript) {
    if (script.status !== "ready" || !script.path) {
      setUploadedScripts((current) => current.filter((item) => item.id !== script.id));
      return;
    }

    setRemovingScriptIds((current) => [...current, script.id]);
    setError("");

    try {
      const params = new URLSearchParams({ path: script.path });
      const response = await fetch(`/_wcu-api/skills/script-upload?${params.toString()}`, {
        method: "DELETE"
      });
      const result = await readJson<{ message?: string; ok?: boolean }>(response);

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "剧本文件移除失败。");
      }

      setUploadedScripts((current) => current.filter((item) => item.id !== script.id));
      setNotice(`已移除《${script.name}》，后续执行不会再读取该文件。`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "剧本文件移除失败。");
    } finally {
      setRemovingScriptIds((current) => current.filter((id) => id !== script.id));
    }
  }

  async function ensureProject() {
    if (projectChoice !== "new") return selectedProject;
    if (!newProjectName.trim()) throw new Error("请填写新项目名称。");
    const response = await fetch("/_wcu-api/projects", {
      body: JSON.stringify({
        aspectRatio: "9:16",
        deliverables: selectedModule?.outputs ?? [],
        goal: selectedGoal?.label ?? "Skill 创作任务",
        name: newProjectName.trim(),
        source: combinedUserInput,
        style: "",
        type: "短剧漫剧"
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const result = await readJson<ProjectResponse>(response);
    if (!response.ok || !result.ok || !result.project) {
      throw new Error(result.message || "项目创建失败。");
    }
    setProjects((current) => [result.project as StoredProject, ...current]);
    setProjectChoice(result.project.id);
    return result.project;
  }

  async function runTask() {
    if (!canRun || !selectedGoal || !selectedSkill || !selectedModule) {
      setError("请完成四个步骤后再开始执行。");
      return;
    }
    if (!modelAllowed) {
      setError(account?.modelAccess?.message || "当前灵穹 API 账户暂不可调用模型，请先进入充值与账单完成账户准备。");
      return;
    }

    setRunning(true);
    setError("");
    setNotice("");
    try {
      const project = await ensureProject();
      if (!project) throw new Error("没有找到关联项目。");
      const response = await fetch("/_wcu-api/skills/run", {
        body: JSON.stringify({
          generatedPrompt: selectedGoal.prompt,
          moduleId: selectedModule.id,
          project: {
            focus: userInput.trim(),
            frame: project.aspectRatio,
            platform: "灵穹创作者平台",
            projectName: project.name,
            sourcePath: readyScripts.map((script) => script.path).join(", ")
          },
          runOptions: { executionDepth, outputFormat },
          skillId: selectedSkill.id,
          userInput: combinedUserInput
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
      const result = await readJson<RunResponse>(response);
      if (!response.ok || !result.ok || !result.run) {
        if (result.rechargeUrl) setRechargeUrl(result.rechargeUrl);
        throw new Error(result.message || "任务执行失败。");
      }
      setRuns((current) => [result.run as SkillRun, ...current]);
      setNotice("任务已完成，结果已记录到本次工作台。你可以复制、下载或进入项目继续制作。");
      setView("history");
      await loadWorkspace();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "任务执行失败。");
    } finally {
      setRunning(false);
    }
  }

  async function copyResult(run: SkillRun) {
    if (!run.outputText) return;
    await navigator.clipboard.writeText(run.outputText);
    setNotice("结果已复制到剪贴板。");
  }

  function downloadResult(run: SkillRun) {
    if (!run.outputText) return;
    const blob = new Blob([run.outputText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${run.projectName || "灵穹任务"}-${run.moduleTitle}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#020608] px-5 pb-24 pt-32 text-stone-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[28px] border border-cyan-200/15 bg-[radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.13),transparent_30%),linear-gradient(145deg,rgba(11,26,34,0.98),rgba(4,8,12,0.98))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.38)] sm:p-8">
          <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Lingqiong Creation Desk
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-5xl">今天想完成什么？</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-stone-400">
                从创作目标出发，系统会推荐合适的 Skill 和任务模块。你只需关联项目、补充材料，然后获得可继续制作的结果。
              </p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:min-w-[500px]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-stone-500">模型状态</p>
                <p className={cn("mt-2 text-sm font-medium", modelAllowed ? "text-emerald-200" : "text-amber-200")}>
                  {modelAllowed ? "可直接使用" : "需要完成账户准备"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-stone-500">账户余额</p>
                <p className="mt-2 truncate font-mono text-sm font-medium text-white">{balanceText(account?.apiAccount)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs text-stone-500">可用能力</p>
                <p className="mt-2 text-sm font-medium text-white">{skills.length} 个 Skill</p>
              </div>
            </div>
          </div>
          {!modelAllowed && !loading ? (
            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                <div>
                  <p className="font-medium text-amber-50">模型功能需要使用你自己的灵穹 API 账户</p>
                  <p className="mt-1 text-sm leading-6 text-stone-400">{account?.modelAccess?.message || modelStatus.message}</p>
                </div>
              </div>
              <Link className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-stone-950" href={rechargeUrl}>
                <CircleDollarSign className="h-4 w-4" />充值与账单
              </Link>
            </div>
          ) : null}
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10">
          <div className="flex gap-1" role="tablist" aria-label="Skill 工作台导航">
            {([
              ["start", "开始任务", Play],
              ["library", "Skill 库", LibraryBig],
              ["history", "本次结果", History]
            ] as const).map(([id, label, Icon]) => (
              <button
                aria-selected={view === id}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-4 text-sm transition",
                  view === id ? "border-cyan-200 text-white" : "border-transparent text-stone-500 hover:text-stone-200"
                )}
                key={id}
                onClick={() => setView(id)}
                role="tab"
                type="button"
              >
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pb-3">
            <Link className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-stone-400 hover:border-white/20 hover:text-white" href="/projects"><FolderKanban className="h-4 w-4" />我的项目</Link>
            <Link className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-stone-400 hover:border-white/20 hover:text-white" href="/skills/advanced"><Settings2 className="h-4 w-4" />高级工作区</Link>
            <button aria-label="刷新工作台" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-stone-400 hover:text-white" onClick={() => void loadWorkspace()} type="button"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></button>
          </div>
        </div>

        {error ? <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><span className="leading-6">{error}</span></div> : null}
        {notice ? <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4 text-sm text-emerald-100"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" /><span className="leading-6">{notice}</span></div> : null}

        {loading ? (
          <div className="grid min-h-[420px] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-200" /><p className="mt-4 text-sm text-stone-500">正在准备你的创作工作台…</p></div></div>
        ) : null}

        {!loading && view === "start" ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <section className="rounded-3xl border border-white/10 bg-[#081018]/80 p-5 sm:p-6">
                <SectionHeading active={!goalId} complete={Boolean(goalId)} description="先选择你现在要解决的问题，系统再推荐工具。" number={1} title="选择今天的创作目标" />
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {goals.map((goal) => {
                    const Icon = goal.icon;
                    const active = goal.id === goalId;
                    return (
                      <button className={cn("group rounded-2xl border p-5 text-left transition", active ? "border-cyan-200/50 bg-cyan-200/[0.08]" : "border-white/8 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]")} key={goal.id} onClick={() => chooseGoal(goal)} type="button">
                        <div className="flex items-center justify-between gap-3"><span className={cn("grid h-10 w-10 place-items-center rounded-xl", active ? "bg-cyan-200 text-stone-950" : "bg-white/[0.06] text-cyan-100")}><Icon className="h-5 w-5" /></span>{active ? <Check className="h-5 w-5 text-cyan-200" /> : <ChevronRight className="h-5 w-5 text-stone-700 transition group-hover:translate-x-0.5 group-hover:text-stone-400" />}</div>
                        <h3 className="mt-4 font-semibold text-white">{goal.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{goal.description}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={cn("rounded-3xl border bg-[#081018]/80 p-5 transition sm:p-6", goalId ? "border-white/10" : "border-white/5 opacity-55")}>
                <SectionHeading active={Boolean(goalId) && !selectedProjectName} complete={Boolean(selectedProjectName)} description="结果会归入这个项目，方便之后继续制作。" number={2} title="关联一个项目" />
                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select className="h-12 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none focus:border-cyan-200/50" disabled={!goalId} onChange={(event) => setProjectChoice(event.target.value)} value={projectChoice}>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.type}</option>)}
                    <option value="new">＋ 创建新项目</option>
                  </select>
                  {selectedProject ? <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-stone-300 hover:text-white" href={`/projects/${selectedProject.id}`}>查看项目<ArrowRight className="h-4 w-4" /></Link> : null}
                </div>
                {projectChoice === "new" ? <label className="mt-3 grid gap-2"><span className="text-xs text-stone-500">新项目名称</span><div className="relative"><Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600" /><input className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pl-11 pr-4 text-sm text-white outline-none placeholder:text-stone-700 focus:border-cyan-200/50" disabled={!goalId} maxLength={100} onChange={(event) => setNewProjectName(event.target.value)} placeholder="例如：战纪宇宙001《火种》" value={newProjectName} /></div></label> : null}
              </section>

              <section className={cn("rounded-3xl border bg-[#081018]/80 p-5 transition sm:p-6", selectedProjectName ? "border-white/10" : "border-white/5 opacity-55")}>
                <SectionHeading active={Boolean(selectedProjectName) && !selectedModule} complete={Boolean(selectedModule)} description="已按目标排序；你仍可自由切换 Skill 和具体模块。" number={3} title="确认推荐的 Skill" />
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {recommendedSkills.slice(0, 4).map((skill, index) => {
                    const active = skill.id === selectedSkillId;
                    return (
                      <button className={cn("rounded-2xl border p-4 text-left transition", active ? "border-cyan-200/45 bg-cyan-200/[0.07]" : "border-white/8 bg-black/20 hover:border-white/20")} disabled={!selectedProjectName} key={skill.id} onClick={() => chooseSkill(skill)} type="button">
                        <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-cyan-200">{skill.category}</span>{index === 0 && selectedGoal ? <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] text-emerald-200">优先推荐</span> : null}</div><h3 className="mt-2 font-semibold text-white">{skill.displayName}</h3></div>{active ? <Check className="h-5 w-5 shrink-0 text-cyan-200" /> : null}</div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-500">{skill.description}</p>
                      </button>
                    );
                  })}
                </div>
                {selectedSkill ? <div className="mt-5 border-t border-white/8 pt-5"><p className="text-xs font-medium text-stone-400">这次要执行的模块</p><div className="mt-3 flex flex-wrap gap-2">{selectedSkill.modules.map((module) => <button className={cn("rounded-full border px-3 py-2 text-xs transition", module.id === selectedModuleId ? "border-cyan-200/50 bg-cyan-200/10 text-cyan-50" : "border-white/10 text-stone-500 hover:text-stone-200")} key={module.id} onClick={() => setSelectedModuleId(module.id)} type="button">{module.order} · {module.shortTitle || module.title}</button>)}</div></div> : null}
              </section>

              <section className={cn("rounded-3xl border bg-[#081018]/80 p-5 transition sm:p-6", selectedModule ? "border-white/10" : "border-white/5 opacity-55")}>
                <SectionHeading active={Boolean(selectedModule) && !combinedUserInput} complete={Boolean(combinedUserInput)} description="直接上传完整剧本，也可以补充限制和期望；系统会把文件正文一起交给任务。" number={4} title="补充材料并执行" />
                {selectedModule ? <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-xs font-medium text-stone-400">建议准备</p><div className="mt-3 flex flex-wrap gap-2">{selectedModule.materials.map((item) => <span className="rounded-lg bg-white/[0.045] px-3 py-2 text-xs text-stone-400" key={item}>{item}</span>)}</div></div> : null}
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_230px]">
                  <label className={cn("group flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-cyan-200/25 bg-cyan-200/[0.045] p-4 transition hover:border-cyan-200/50 hover:bg-cyan-200/[0.075]", !selectedModule && "pointer-events-none opacity-50")}>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan-200/10 text-cyan-100"><UploadCloud className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-semibold text-white">直接上传剧本</span>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">选择文件后自动提取正文，无需手动复制</span>
                    </span>
                    <input
                      accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                      className="sr-only"
                      disabled={!selectedModule}
                      multiple
                      onChange={(event) => {
                        const files = Array.from(event.currentTarget.files ?? []);
                        event.currentTarget.value = "";
                        void uploadScriptFiles(files);
                      }}
                      type="file"
                    />
                  </label>
                  <div className="flex min-h-24 items-center rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-medium text-stone-300"><FileText className="h-4 w-4 text-cyan-200" />支持格式</p>
                      <p className="mt-2 text-xs leading-5 text-stone-500">TXT / Markdown / DOCX / PDF</p>
                      <p className="text-xs leading-5 text-stone-600">单个文件不超过 20MB</p>
                    </div>
                  </div>
                </div>
                {uploadedScripts.length ? (
                  <div className="mt-3 space-y-2" aria-live="polite">
                    {uploadedScripts.map((script) => {
                      const removing = removingScriptIds.includes(script.id);
                      return (
                        <div className={cn("flex items-start gap-3 rounded-xl border p-3", script.status === "error" ? "border-red-300/20 bg-red-300/[0.045]" : "border-white/8 bg-black/20")} key={script.id}>
                          <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg", script.status === "ready" ? "bg-emerald-300/10 text-emerald-200" : script.status === "error" ? "bg-red-300/10 text-red-200" : "bg-cyan-200/10 text-cyan-200")}>
                            {script.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : script.status === "ready" ? <FileCheck2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-stone-200">{script.name}</p>
                            <p className={cn("mt-1 text-xs leading-5", script.status === "error" ? "text-red-200/80" : "text-stone-500")}>
                              {script.status === "uploading"
                                ? `正在上传并读取 · ${formatBytes(script.size)}`
                                : script.status === "error"
                                  ? script.message || "读取失败"
                                  : `已读取 ${script.characterCount.toLocaleString("zh-CN")} 字 · ${formatBytes(script.size)}${script.truncated ? ` · 本次带入前 ${script.includedCharacterCount.toLocaleString("zh-CN")} 字` : ""}`}
                            </p>
                            {script.status === "ready" && script.warnings.length ? <p className="mt-1 text-xs leading-5 text-amber-200/75">{script.warnings.join("；")}</p> : null}
                          </div>
                          <button aria-label={`移除 ${script.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/8 text-stone-500 transition hover:border-red-300/25 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40" disabled={script.status === "uploading" || removing} onClick={() => void removeUploadedScript(script)} type="button">{removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <textarea className="mt-4 min-h-44 w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-white outline-none placeholder:text-stone-700 focus:border-cyan-200/50" disabled={!selectedModule} onChange={(event) => setUserInput(event.target.value)} placeholder="补充创作目标、保留结构、最担心的问题、目标平台或其他限制…" value={userInput} />
                <details className="mt-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3"><summary className="cursor-pointer text-sm text-stone-400">执行偏好（可选）</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-xs text-stone-500">执行深度<select className="h-10 rounded-lg border border-white/10 bg-[#05090d] px-3 text-sm text-white" onChange={(event) => setExecutionDepth(event.target.value)} value={executionDepth}><option>快速草案</option><option>完整执行</option><option>深度制作</option></select></label><label className="grid gap-2 text-xs text-stone-500">输出格式<select className="h-10 rounded-lg border border-white/10 bg-[#05090d] px-3 text-sm text-white" onChange={(event) => setOutputFormat(event.target.value)} value={outputFormat}><option>结构化正文</option><option>执行清单</option><option>表格与正文</option></select></label></div></details>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-stone-600">执行会调用你的灵穹 API 账户，并按实际模型消耗计费。</p><button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-200 px-6 text-sm font-semibold text-stone-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500" disabled={!canRun || running || !modelAllowed} onClick={() => void runTask()} type="button">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}{running ? "正在执行…" : "开始执行任务"}</button></div>
              </section>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
              <div className="rounded-3xl border border-white/10 bg-[#081018]/90 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Task Summary</p>
                <h2 className="mt-3 text-xl font-semibold text-white">任务确认</h2>
                <div className="mt-5 space-y-4 text-sm">
                  {[
                    ["目标", selectedGoal?.label || "待选择"],
                    ["项目", selectedProjectName || "待关联"],
                    ["Skill", selectedSkill?.displayName || "待推荐"],
                    ["模块", selectedModule?.title || "待选择"]
                  ].map(([label, value]) => <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-3 last:border-0 last:pb-0" key={label}><span className="text-stone-600">{label}</span><span className="max-w-[190px] text-right text-stone-300">{value}</span></div>)}
                </div>
              </div>
              {selectedModule ? <div className="rounded-3xl border border-white/10 bg-[#081018]/90 p-5"><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-cyan-200" /><h2 className="font-semibold text-white">预计产出</h2></div><div className="mt-4 space-y-2">{selectedModule.outputs.map((output) => <div className="flex items-start gap-2 text-sm text-stone-400" key={output}><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><span>{output}</span></div>)}</div>{selectedModule.nextStep ? <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-3"><p className="text-xs text-stone-600">完成后</p><p className="mt-1 text-sm leading-6 text-stone-400">{selectedModule.nextStep}</p></div> : null}</div> : null}
              <div className="rounded-3xl border border-white/10 bg-[#081018]/90 p-5"><h2 className="font-semibold text-white">其他入口</h2><div className="mt-4 grid gap-2"><Link className="flex items-center justify-between rounded-xl border border-white/8 px-4 py-3 text-sm text-stone-400 hover:border-white/20 hover:text-white" href="/knowledge"><span className="flex items-center gap-2"><LibraryBig className="h-4 w-4" />知识库</span><ChevronRight className="h-4 w-4" /></Link><Link className="flex items-center justify-between rounded-xl border border-white/8 px-4 py-3 text-sm text-stone-400 hover:border-white/20 hover:text-white" href="/account"><span className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4" />用户中心</span><ChevronRight className="h-4 w-4" /></Link><Link className="flex items-center justify-between rounded-xl border border-white/8 px-4 py-3 text-sm text-stone-400 hover:border-white/20 hover:text-white" href="/skills/advanced"><span className="flex items-center gap-2"><Boxes className="h-4 w-4" />文件与自建 Skill</span><ChevronRight className="h-4 w-4" /></Link></div></div>
            </aside>
          </div>
        ) : null}

        {!loading && view === "library" ? (
          <section className="mt-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Capability Library</p><h2 className="mt-3 text-3xl font-semibold text-white">选择能完成任务的能力</h2><p className="mt-2 text-sm text-stone-500">平台发布的 Skill 与你自己的私有 Skill 会在这里统一出现。</p></div><Link className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-stone-300 hover:text-white" href="/skills/advanced"><FileInput className="h-4 w-4" />上传或创建 Skill</Link></div>
            <div className="mt-6 flex flex-wrap gap-2">{categories.map((item) => <button className={cn("rounded-full border px-4 py-2 text-xs", category === item ? "border-cyan-200/50 bg-cyan-200/10 text-cyan-50" : "border-white/10 text-stone-500 hover:text-stone-200")} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleSkills.map((skill) => <article className="rounded-3xl border border-white/10 bg-[#081018]/80 p-5" key={skill.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-cyan-200">{skill.category}</p><h3 className="mt-2 text-lg font-semibold text-white">{skill.displayName}</h3></div><span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-stone-500">{skill.modules.length} 模块</span></div><p className="mt-3 line-clamp-3 min-h-[72px] text-sm leading-6 text-stone-500">{skill.description}</p><div className="mt-4 flex flex-wrap gap-2">{skill.modules.slice(0, 4).map((module) => <span className="rounded-lg border border-white/8 px-2.5 py-1.5 text-xs text-stone-500" key={module.id}>{module.shortTitle || module.title}</span>)}</div><button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/[0.055] px-4 py-3 text-sm text-cyan-50 hover:bg-cyan-200/10" onClick={() => { chooseSkill(skill); setGoalId((current) => current || "solve-blocker"); setView("start"); }} type="button">用这个 Skill 开始<ArrowRight className="h-4 w-4" /></button></article>)}</div>
          </section>
        ) : null}

        {!loading && view === "history" ? (
          <section className="mt-8">
            <div><p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Current Session</p><h2 className="mt-3 text-3xl font-semibold text-white">本次生成结果</h2><p className="mt-2 text-sm text-stone-500">结果同时写入系统运行记录；请复制或下载需要继续加工的正文。</p></div>
            {runs.length ? <div className="mt-6 space-y-5">{runs.map((run) => <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#081018]/85" key={run.id}><div className="flex flex-col gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] text-emerald-200">已完成</span><span className="text-xs text-stone-600">{formatDate(run.createdAt)}</span></div><h3 className="mt-2 font-semibold text-white">{run.projectName || "未命名项目"} · {run.moduleTitle}</h3><p className="mt-1 text-xs text-stone-500">{run.skillName}{run.model ? ` / ${run.model}` : ""}</p></div><div className="flex gap-2"><button className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-stone-300 hover:text-white" onClick={() => void copyResult(run)} type="button"><Clipboard className="h-4 w-4" />复制</button><button className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-stone-300 hover:text-white" onClick={() => downloadResult(run)} type="button"><Download className="h-4 w-4" />下载</button></div></div><div className="max-h-[680px] overflow-auto whitespace-pre-wrap p-5 text-sm leading-7 text-stone-300 sm:p-7">{run.outputText || "暂无输出"}</div></article>)}</div> : <div className="mt-8 grid min-h-80 place-items-center rounded-3xl border border-dashed border-white/10 bg-white/[0.018] text-center"><div><History className="mx-auto h-10 w-10 text-stone-700" /><p className="mt-4 font-medium text-stone-300">本次还没有生成结果</p><p className="mt-2 text-sm text-stone-600">从“开始任务”完成四个步骤后，结果会出现在这里。</p><button className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-200 px-4 py-2.5 text-sm font-semibold text-stone-950" onClick={() => setView("start")} type="button">开始第一个任务<ArrowRight className="h-4 w-4" /></button></div></div>}
          </section>
        ) : null}
      </div>
    </div>
  );
}
