"use client";

import Link from "next/link";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Clock3,
  Film,
  Layers3,
  ListChecks,
  Loader2,
  Mic2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X
} from "lucide-react";

import { cn } from "@/lib/utils";

type Project = {
  aspectRatio: string;
  coverImage?: string;
  createdAt: string;
  deliverables: string[];
  goal: string;
  id: string;
  name: string;
  source: string;
  style: string;
  type: string;
  updatedAt: string;
};

type Episode = {
  createdAt: string;
  episodeNumber: number;
  id: string;
  projectId: string;
  script: string;
  sortOrder: number;
  status: "draft" | "ready" | "locked" | "archived";
  summary: string;
  title: string;
  updatedAt: string;
};

type ProductionStatus =
  | "draft"
  | "ready"
  | "queued"
  | "generating"
  | "rendering"
  | "completed"
  | "failed"
  | "archived";

type ProductionElement = {
  aliases: string[];
  createdAt: string;
  description: string;
  episodeId?: string;
  id: string;
  kind: "role" | "scene" | "prop";
  name: string;
  notes: string;
  projectId: string;
  prompt: string;
  referenceImageUrl?: string;
  sortOrder: number;
  status: ProductionStatus;
  updatedAt: string;
  voiceProfileId?: string;
};

type Storyboard = {
  camera: string;
  createdAt: string;
  dialogue: string;
  durationMs: number;
  elementIds: string[];
  episodeId: string;
  id: string;
  imageUrl?: string;
  negativePrompt: string;
  projectId: string;
  prompt: string;
  referenceImageUrl?: string;
  shotNumber: number;
  sortOrder: number;
  status: ProductionStatus;
  title: string;
  updatedAt: string;
  videoUrl?: string;
};

type Voiceover = {
  audioUrl?: string;
  createdAt: string;
  durationMs: number;
  episodeId: string;
  id: string;
  lineText: string;
  projectId: string;
  roleElementId?: string;
  sortOrder: number;
  speakerName: string;
  status: ProductionStatus;
  storyboardId?: string;
  updatedAt: string;
  voiceProfileId?: string;
};

type Composition = {
  createdAt: string;
  episodeId: string;
  id: string;
  outputUrl?: string;
  projectId: string;
  revision: number;
  settings: Record<string, unknown>;
  status: ProductionStatus;
  timeline: unknown[];
  updatedAt: string;
};

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type ResourceType = "episode" | "element" | "storyboard" | "voiceover" | "composition";
type TaskType =
  | "script_analysis"
  | "element_image"
  | "storyboard_image"
  | "storyboard_video"
  | "voiceover_audio"
  | "composition_export";

type GenerationJob = {
  attemptCount: number;
  createdAt: string;
  episodeId?: string;
  error?: string;
  id: string;
  resourceId: string;
  resourceType: ResourceType;
  status: JobStatus;
  taskType: TaskType;
  updatedAt: string;
};

type TabId =
  | "overview"
  | "episodes"
  | "elements"
  | "storyboards"
  | "voiceovers"
  | "composition"
  | "jobs";

type EpisodeDraft = Pick<Episode, "episodeNumber" | "script" | "status" | "summary" | "title">;
type ElementDraft = Pick<
  ProductionElement,
  "aliases" | "description" | "kind" | "name" | "notes" | "prompt" | "status"
> & { episodeId: string; referenceImageUrl: string };
type StoryboardDraft = Pick<
  Storyboard,
  | "camera"
  | "dialogue"
  | "durationMs"
  | "elementIds"
  | "negativePrompt"
  | "prompt"
  | "shotNumber"
  | "status"
  | "title"
> & { episodeId: string; imageUrl: string; referenceImageUrl: string; videoUrl: string };
type VoiceoverDraft = Pick<
  Voiceover,
  "durationMs" | "lineText" | "speakerName" | "status"
> & {
  audioUrl: string;
  episodeId: string;
  roleElementId: string;
  storyboardId: string;
  voiceProfileId: string;
};

const tabs: Array<{ id: TabId; icon: typeof Film; label: string }> = [
  { id: "overview", icon: Film, label: "项目概览" },
  { id: "episodes", icon: Layers3, label: "剧集" },
  { id: "elements", icon: Boxes, label: "角色与资产" },
  { id: "storyboards", icon: Clapperboard, label: "分镜" },
  { id: "voiceovers", icon: Mic2, label: "配音" },
  { id: "composition", icon: ListChecks, label: "合成" },
  { id: "jobs", icon: Clock3, label: "生成任务" }
];

const productionStatusLabels: Record<ProductionStatus, string> = {
  archived: "已归档",
  completed: "已完成",
  draft: "草稿",
  failed: "失败",
  generating: "生成中",
  queued: "已排队",
  ready: "可生产",
  rendering: "渲染中"
};

const jobStatusLabels: Record<JobStatus, string> = {
  cancelled: "已取消",
  failed: "失败",
  queued: "已排队",
  running: "执行中",
  succeeded: "成功"
};

const taskLabels: Record<TaskType, string> = {
  composition_export: "导出成片",
  element_image: "生成元素图",
  script_analysis: "分析剧本",
  storyboard_image: "生成分镜图",
  storyboard_video: "生成分镜视频",
  voiceover_audio: "生成配音"
};

const elementKindLabels = { prop: "道具", role: "角色", scene: "场景" } as const;
const fieldClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-300/50 focus:bg-black/35";
const panelClass =
  "rounded-2xl border border-white/10 bg-[#0a0d13]/86 shadow-2xl shadow-black/20 backdrop-blur-xl";

const emptyEpisodeDraft = (): EpisodeDraft => ({
  episodeNumber: 1,
  script: "",
  status: "draft",
  summary: "",
  title: ""
});

const emptyElementDraft = (): ElementDraft => ({
  aliases: [],
  description: "",
  episodeId: "",
  kind: "role",
  name: "",
  notes: "",
  prompt: "",
  referenceImageUrl: "",
  status: "draft"
});

const emptyStoryboardDraft = (): StoryboardDraft => ({
  camera: "",
  dialogue: "",
  durationMs: 3000,
  elementIds: [],
  episodeId: "",
  imageUrl: "",
  negativePrompt: "",
  prompt: "",
  referenceImageUrl: "",
  shotNumber: 1,
  status: "draft",
  title: "",
  videoUrl: ""
});

const emptyVoiceoverDraft = (): VoiceoverDraft => ({
  audioUrl: "",
  durationMs: 0,
  episodeId: "",
  lineText: "",
  roleElementId: "",
  speakerName: "",
  status: "draft",
  storyboardId: "",
  voiceProfileId: ""
});

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function compactId(value: string) {
  return value.length > 14 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string }; message?: string })
    | null;

  if (response.status === 401) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("登录状态已失效，正在返回登录页。");
  }

  if (!response.ok || !data) {
    throw new Error(data?.error?.message ?? data?.message ?? `请求失败（${response.status}）`);
  }

  return data;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-xs font-medium tracking-[0.08em] text-stone-400">
      {label}
      {children}
    </label>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "number" | "url";
  value: string | number;
}) {
  return (
    <Field label={label}>
      <input
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </Field>
  );
}

function TextArea({
  label,
  onChange,
  placeholder,
  rows = 4,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) {
  return (
    <Field label={label}>
      <textarea
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        value={value}
      />
    </Field>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field label={label}>
      <select
        className={fieldClass}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </Field>
  );
}

function StatusBadge({ status }: { status: JobStatus | ProductionStatus | Episode["status"] }) {
  const isGood = status === "ready" || status === "completed" || status === "succeeded";
  const isBad = status === "failed" || status === "cancelled";
  const label = status in jobStatusLabels
    ? jobStatusLabels[status as JobStatus]
    : productionStatusLabels[status as ProductionStatus] ?? status;

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        isGood && "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
        isBad && "border-red-300/25 bg-red-300/10 text-red-200",
        !isGood && !isBad && "border-cyan-300/20 bg-cyan-300/8 text-cyan-100"
      )}
    >
      {label}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone = "default",
  type = "button"
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  tone?: "default" | "danger" | "primary";
  type?: "button" | "submit";
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        tone === "primary" &&
          "border-cyan-200/35 bg-cyan-200 text-slate-950 hover:bg-white",
        tone === "danger" &&
          "border-red-300/20 bg-red-300/8 text-red-200 hover:bg-red-300/15",
        tone === "default" &&
          "border-white/10 bg-white/5 text-stone-200 hover:border-white/20 hover:bg-white/10"
      )}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center text-sm leading-7 text-stone-500">
      {children}
    </div>
  );
}

export function ProjectProductionStudio({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [project, setProject] = useState<Project | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [elements, setElements] = useState<ProductionElement[]>([]);
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [voiceovers, setVoiceovers] = useState<Voiceover[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("");
  const [composition, setComposition] = useState<Composition | null>(null);
  const [compositionsByEpisode, setCompositionsByEpisode] = useState<
    Record<string, Composition | null>
  >({});
  const [compositionRevision, setCompositionRevision] = useState(0);
  const [compositionTimeline, setCompositionTimeline] = useState("[]");
  const [compositionRatio, setCompositionRatio] = useState("16:9");
  const [compositionResolution, setCompositionResolution] = useState("1920x1080");
  const [compositionTransition, setCompositionTransition] = useState("cut");
  const [compositionFit, setCompositionFit] = useState("cover");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);

  const [episodeDraft, setEpisodeDraft] = useState<EpisodeDraft>(emptyEpisodeDraft);
  const [editingEpisodeId, setEditingEpisodeId] = useState("");
  const [elementDraft, setElementDraft] = useState<ElementDraft>(emptyElementDraft);
  const [editingElementId, setEditingElementId] = useState("");
  const [elementFilter, setElementFilter] = useState<"all" | ProductionElement["kind"]>("all");
  const [storyboardDraft, setStoryboardDraft] =
    useState<StoryboardDraft>(emptyStoryboardDraft);
  const [editingStoryboardId, setEditingStoryboardId] = useState("");
  const [voiceoverDraft, setVoiceoverDraft] =
    useState<VoiceoverDraft>(emptyVoiceoverDraft);
  const [editingVoiceoverId, setEditingVoiceoverId] = useState("");

  const apiBase = `/_wcu-api/projects/${projectId}`;

  const loadStudio = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [projectResult, episodeResult, elementResult, boardResult, voiceResult, jobResult] =
        await Promise.all([
          apiRequest<{ project: Project }>(apiBase),
          apiRequest<{ episodes: Episode[] }>(`${apiBase}/episodes`),
          apiRequest<{ elements: ProductionElement[] }>(`${apiBase}/elements`),
          apiRequest<{ storyboards: Storyboard[] }>(`${apiBase}/storyboards`),
          apiRequest<{ voiceovers: Voiceover[] }>(`${apiBase}/voiceovers`),
          apiRequest<{ jobs: GenerationJob[] }>(`${apiBase}/generation-jobs?limit=100`)
        ]);

      setProject(projectResult.project);
      setEpisodes(episodeResult.episodes);
      setElements(elementResult.elements);
      setStoryboards(boardResult.storyboards);
      setVoiceovers(voiceResult.voiceovers);
      setJobs(jobResult.jobs);
      const compositionEntries = await Promise.all(
        episodeResult.episodes.map(async (episode) => {
          try {
            const result = await apiRequest<{ composition: Composition | null }>(
              `${apiBase}/compositions/${episode.id}`
            );
            return [episode.id, result.composition] as const;
          } catch {
            return [episode.id, null] as const;
          }
        })
      );
      setCompositionsByEpisode(Object.fromEntries(compositionEntries));
      setSelectedEpisodeId((current) =>
        episodeResult.episodes.some((episode) => episode.id === current)
          ? current
          : episodeResult.episodes[0]?.id ?? ""
      );
      setEpisodeDraft((current) => ({
        ...current,
        episodeNumber: episodeResult.episodes.length + 1
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "项目生产数据加载失败。");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadStudio(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadStudio]);

  const defaultCompositionRatio = project?.aspectRatio ?? "16:9";
  const loadComposition = useCallback(async () => {
    if (!selectedEpisodeId) {
      setComposition(null);
      setCompositionRevision(0);
      setCompositionTimeline("[]");
      return;
    }

    try {
      const result = await apiRequest<{
        composition: Composition | null;
        revision: number;
      }>(`${apiBase}/compositions/${selectedEpisodeId}`);
      const next = result.composition;
      setComposition(next);
      setCompositionsByEpisode((current) => ({
        ...current,
        [selectedEpisodeId]: next
      }));
      setCompositionRevision(result.revision);
      setCompositionTimeline(JSON.stringify(next?.timeline ?? [], null, 2));
      const settings = next?.settings ?? {};
      setCompositionRatio(String(settings.aspectRatio ?? defaultCompositionRatio));
      setCompositionResolution(String(settings.resolution ?? "1920x1080"));
      setCompositionTransition(String(settings.transition ?? "cut"));
      setCompositionFit(String(settings.fit ?? "cover"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "合成工程加载失败。");
    }
  }, [apiBase, defaultCompositionRatio, selectedEpisodeId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadComposition(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadComposition]);

  const selectedEpisode = episodes.find((episode) => episode.id === selectedEpisodeId);
  const selectedBoards = useMemo(
    () => storyboards.filter((board) => board.episodeId === selectedEpisodeId),
    [selectedEpisodeId, storyboards]
  );
  const selectedVoiceovers = useMemo(
    () => voiceovers.filter((voiceover) => voiceover.episodeId === selectedEpisodeId),
    [selectedEpisodeId, voiceovers]
  );
  const availableElements = useMemo(
    () =>
      elements.filter(
        (element) => !element.episodeId || element.episodeId === storyboardDraft.episodeId
      ),
    [elements, storyboardDraft.episodeId]
  );
  const visibleElements = useMemo(
    () => elements.filter((element) => elementFilter === "all" || element.kind === elementFilter),
    [elementFilter, elements]
  );

  function beginOperation() {
    setSaving(true);
    setError("");
    setMessage("");
  }

  function finishOperation(caught?: unknown) {
    if (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败，请稍后重试。");
    }
    setSaving(false);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    beginOperation();

    try {
      const result = await apiRequest<{ project: Project }>(apiBase, {
        body: JSON.stringify({
          aspectRatio: project.aspectRatio,
          deliverables: project.deliverables,
          goal: project.goal,
          name: project.name,
          source: project.source,
          style: project.style,
          type: project.type
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      });
      setProject(result.project);
      setMessage("项目概览已保存到数据库。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  async function saveEpisode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginOperation();

    try {
      const path = editingEpisodeId
        ? `${apiBase}/episodes/${editingEpisodeId}`
        : `${apiBase}/episodes`;
      const result = await apiRequest<{ episode: Episode }>(path, {
        body: JSON.stringify(episodeDraft),
        headers: { "Content-Type": "application/json" },
        method: editingEpisodeId ? "PATCH" : "POST"
      });
      setEpisodes((current) =>
        editingEpisodeId
          ? current.map((item) => (item.id === editingEpisodeId ? result.episode : item))
          : [...current, result.episode].sort((a, b) => a.sortOrder - b.sortOrder)
      );
      setSelectedEpisodeId(result.episode.id);
      setEditingEpisodeId("");
      setEpisodeDraft({ ...emptyEpisodeDraft(), episodeNumber: episodes.length + 2 });
      setMessage(editingEpisodeId ? "剧集已更新。" : "剧集已创建。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  function editEpisode(episode: Episode) {
    setEditingEpisodeId(episode.id);
    setEpisodeDraft({
      episodeNumber: episode.episodeNumber,
      script: episode.script,
      status: episode.status,
      summary: episode.summary,
      title: episode.title
    });
    setSelectedEpisodeId(episode.id);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function removeEpisode(episode: Episode) {
    if (!window.confirm(`确认删除「${episode.title}」及其关联分镜、配音和合成数据吗？`)) return;
    beginOperation();

    try {
      await apiRequest(`${apiBase}/episodes/${episode.id}`, { method: "DELETE" });
      const remaining = episodes.filter((item) => item.id !== episode.id);
      setEpisodes(remaining);
      setElements((current) => current.filter((item) => item.episodeId !== episode.id));
      setStoryboards((current) => current.filter((item) => item.episodeId !== episode.id));
      setVoiceovers((current) => current.filter((item) => item.episodeId !== episode.id));
      setCompositionsByEpisode((current) => {
        const next = { ...current };
        delete next[episode.id];
        return next;
      });
      setSelectedEpisodeId(remaining[0]?.id ?? "");
      setMessage("剧集及关联生产数据已删除。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  async function saveElement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginOperation();

    try {
      const path = editingElementId
        ? `${apiBase}/elements/${editingElementId}`
        : `${apiBase}/elements`;
      const payload = {
        ...elementDraft,
        aliases: elementDraft.aliases,
        episodeId: elementDraft.episodeId || null,
        referenceImageUrl: elementDraft.referenceImageUrl || null
      };
      const result = await apiRequest<{ element: ProductionElement }>(path, {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: editingElementId ? "PATCH" : "POST"
      });
      setElements((current) =>
        editingElementId
          ? current.map((item) => (item.id === editingElementId ? result.element : item))
          : [...current, result.element]
      );
      setEditingElementId("");
      setElementDraft(emptyElementDraft());
      setMessage(editingElementId ? "元素已更新。" : "元素已创建。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  function editElement(element: ProductionElement) {
    setEditingElementId(element.id);
    setElementDraft({
      aliases: element.aliases,
      description: element.description,
      episodeId: element.episodeId ?? "",
      kind: element.kind,
      name: element.name,
      notes: element.notes,
      prompt: element.prompt,
      referenceImageUrl: element.referenceImageUrl ?? "",
      status: element.status
    });
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function removeElement(element: ProductionElement) {
    if (!window.confirm(`确认删除${elementKindLabels[element.kind]}「${element.name}」吗？`)) return;
    beginOperation();

    try {
      await apiRequest(`${apiBase}/elements/${element.id}`, { method: "DELETE" });
      setElements((current) => current.filter((item) => item.id !== element.id));
      setStoryboards((current) =>
        current.map((board) => ({
          ...board,
          elementIds: board.elementIds.filter((id) => id !== element.id)
        }))
      );
      setMessage("元素已删除，分镜引用已同步移除。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  async function saveStoryboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginOperation();

    try {
      const path = editingStoryboardId
        ? `${apiBase}/storyboards/${editingStoryboardId}`
        : `${apiBase}/storyboards`;
      const result = await apiRequest<{ storyboard: Storyboard }>(path, {
        body: JSON.stringify({
          ...storyboardDraft,
          imageUrl: storyboardDraft.imageUrl || null,
          referenceImageUrl: storyboardDraft.referenceImageUrl || null,
          videoUrl: storyboardDraft.videoUrl || null
        }),
        headers: { "Content-Type": "application/json" },
        method: editingStoryboardId ? "PATCH" : "POST"
      });
      setStoryboards((current) =>
        editingStoryboardId
          ? current.map((item) =>
              item.id === editingStoryboardId ? result.storyboard : item
            )
          : [...current, result.storyboard]
      );
      setSelectedEpisodeId(result.storyboard.episodeId);
      setEditingStoryboardId("");
      setStoryboardDraft({
        ...emptyStoryboardDraft(),
        episodeId: result.storyboard.episodeId,
        shotNumber:
          storyboards.filter((item) => item.episodeId === result.storyboard.episodeId).length + 2
      });
      setMessage(editingStoryboardId ? "分镜已更新。" : "分镜已创建。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  function editStoryboard(board: Storyboard) {
    setEditingStoryboardId(board.id);
    setStoryboardDraft({
      camera: board.camera,
      dialogue: board.dialogue,
      durationMs: board.durationMs,
      elementIds: board.elementIds,
      episodeId: board.episodeId,
      imageUrl: board.imageUrl ?? "",
      negativePrompt: board.negativePrompt,
      prompt: board.prompt,
      referenceImageUrl: board.referenceImageUrl ?? "",
      shotNumber: board.shotNumber,
      status: board.status,
      title: board.title,
      videoUrl: board.videoUrl ?? ""
    });
    setSelectedEpisodeId(board.episodeId);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function removeStoryboard(board: Storyboard) {
    if (!window.confirm(`确认删除「${board.title}」及其关联配音吗？`)) return;
    beginOperation();

    try {
      await apiRequest(`${apiBase}/storyboards/${board.id}`, { method: "DELETE" });
      setStoryboards((current) => current.filter((item) => item.id !== board.id));
      setVoiceovers((current) => current.filter((item) => item.storyboardId !== board.id));
      setMessage("分镜及其关联配音已删除。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  async function saveVoiceover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginOperation();

    try {
      const path = editingVoiceoverId
        ? `${apiBase}/voiceovers/${editingVoiceoverId}`
        : `${apiBase}/voiceovers`;
      const result = await apiRequest<{ voiceover: Voiceover }>(path, {
        body: JSON.stringify({
          ...voiceoverDraft,
          audioUrl: voiceoverDraft.audioUrl || null,
          roleElementId: voiceoverDraft.roleElementId || null,
          storyboardId: voiceoverDraft.storyboardId || null,
          voiceProfileId: voiceoverDraft.voiceProfileId || null
        }),
        headers: { "Content-Type": "application/json" },
        method: editingVoiceoverId ? "PATCH" : "POST"
      });
      setVoiceovers((current) =>
        editingVoiceoverId
          ? current.map((item) =>
              item.id === editingVoiceoverId ? result.voiceover : item
            )
          : [...current, result.voiceover]
      );
      setSelectedEpisodeId(result.voiceover.episodeId);
      setEditingVoiceoverId("");
      setVoiceoverDraft({ ...emptyVoiceoverDraft(), episodeId: result.voiceover.episodeId });
      setMessage(editingVoiceoverId ? "配音条目已更新。" : "配音条目已创建。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  function editVoiceover(voiceover: Voiceover) {
    setEditingVoiceoverId(voiceover.id);
    setVoiceoverDraft({
      audioUrl: voiceover.audioUrl ?? "",
      durationMs: voiceover.durationMs,
      episodeId: voiceover.episodeId,
      lineText: voiceover.lineText,
      roleElementId: voiceover.roleElementId ?? "",
      speakerName: voiceover.speakerName,
      status: voiceover.status,
      storyboardId: voiceover.storyboardId ?? "",
      voiceProfileId: voiceover.voiceProfileId ?? ""
    });
    setSelectedEpisodeId(voiceover.episodeId);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function removeVoiceover(voiceover: Voiceover) {
    if (!window.confirm(`确认删除「${voiceover.lineText.slice(0, 20)}」这条配音吗？`)) return;
    beginOperation();

    try {
      await apiRequest(`${apiBase}/voiceovers/${voiceover.id}`, { method: "DELETE" });
      setVoiceovers((current) => current.filter((item) => item.id !== voiceover.id));
      setMessage("配音条目已删除。");
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  function buildTimelineFromResources() {
    const timeline = selectedBoards.map((board, index) => ({
      audio: selectedVoiceovers
        .filter((voiceover) => voiceover.storyboardId === board.id)
        .map((voiceover) => ({
          audioUrl: voiceover.audioUrl ?? null,
          durationMs: voiceover.durationMs,
          id: voiceover.id
        })),
      durationMs: board.durationMs,
      id: `shot-${board.id}`,
      order: index + 1,
      storyboardId: board.id,
      title: board.title,
      videoUrl: board.videoUrl ?? null
    }));
    setCompositionTimeline(JSON.stringify(timeline, null, 2));
    setMessage("已按本集分镜与配音生成可编辑时间线，保存后才会写入数据库。");
  }

  async function persistComposition(showMessage = true) {
    if (!selectedEpisodeId) throw new Error("请先选择剧集。");
    let timeline: unknown;
    try {
      timeline = JSON.parse(compositionTimeline);
    } catch {
      throw new Error("时间线 JSON 格式不正确。");
    }
    if (!Array.isArray(timeline)) throw new Error("时间线必须是 JSON 数组。");

    const result = await apiRequest<{ composition: Composition; revision: number }>(
      `${apiBase}/compositions/${selectedEpisodeId}`,
      {
        body: JSON.stringify({
          revision: compositionRevision,
          settings: {
            aspectRatio: compositionRatio,
            fit: compositionFit,
            resolution: compositionResolution,
            transition: compositionTransition
          },
          status: "draft",
          timeline
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT"
      }
    );
    setComposition(result.composition);
    setCompositionsByEpisode((current) => ({
      ...current,
      [selectedEpisodeId]: result.composition
    }));
    setCompositionRevision(result.revision);
    if (showMessage) setMessage(`合成工程已保存，当前版本 r${result.revision}。`);
    return result.composition;
  }

  async function saveComposition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    beginOperation();
    try {
      await persistComposition();
      finishOperation();
    } catch (caught) {
      if ((caught as Error).message.includes("其他窗口")) void loadComposition();
      finishOperation(caught);
    }
  }

  async function queueJob(options: {
    episodeId?: string;
    resourceId: string;
    resourceType: ResourceType;
    taskType: TaskType;
  }) {
    beginOperation();
    try {
      const result = await apiRequest<{ job: GenerationJob }>(`${apiBase}/generation-jobs`, {
        body: JSON.stringify({
          episodeId: options.episodeId,
          input: { requestedFrom: "project-production-studio" },
          resourceId: options.resourceId,
          resourceType: options.resourceType,
          taskType: options.taskType
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      setJobs((current) => [result.job, ...current]);
      setMessage(
        `「${taskLabels[options.taskType]}」已创建为 queued 任务。模型执行器接入后才会消费任务，本页面不会伪造生成结果。`
      );
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  async function queueCompositionExport() {
    beginOperation();
    try {
      const saved = await persistComposition(false);
      const result = await apiRequest<{ job: GenerationJob }>(`${apiBase}/generation-jobs`, {
        body: JSON.stringify({
          episodeId: saved.episodeId,
          input: { compositionRevision: saved.revision },
          resourceId: saved.id,
          resourceType: "composition",
          taskType: "composition_export"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      setJobs((current) => [result.job, ...current]);
      setMessage(
        "合成工程已保存并创建 queued 导出任务。只有配置模型执行器后才会真正渲染。"
      );
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  async function queueElementBatch(kind: ProductionElement["kind"]) {
    const targets = elements.filter((element) => element.kind === kind);

    if (!targets.length) {
      setError(`请先创建${elementKindLabels[kind]}资产。`);
      return;
    }

    beginOperation();

    try {
      for (const element of targets) {
        const result = await apiRequest<{ job: GenerationJob }>(
          `${apiBase}/generation-jobs`,
          {
            body: JSON.stringify({
              episodeId: element.episodeId,
              input: { requestedFrom: "project-production-overview-batch" },
              resourceId: element.id,
              resourceType: "element",
              taskType: "element_image"
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST"
          }
        );
        setJobs((current) => [result.job, ...current]);
      }

      setMessage(
        `已将 ${targets.length} 个${elementKindLabels[kind]}图像任务加入生成队列。`
      );
      finishOperation();
    } catch (caught) {
      finishOperation(caught);
    }
  }

  function openDetailedTab(tab: TabId, episodeId?: string) {
    if (episodeId) {
      setSelectedEpisodeId(episodeId);
    }
    setActiveTab(tab);
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function startEpisodeDraft(mode: "ai" | "import" | "manual") {
    setEditingEpisodeId("");
    setEpisodeDraft({
      ...emptyEpisodeDraft(),
      episodeNumber: episodes.length + 1
    });
    setActiveTab("episodes");

    if (mode === "ai") {
      setMessage("先创建剧集并补充故事信息，保存后可使用“分析入队”进入模型生产。 ");
    } else if (mode === "import") {
      setMessage("请将已有剧本粘贴到“完整剧本”，确认集数与标题后保存。 ");
    }

    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function renderEpisodeSelector(label = "当前剧集") {
    return (
      <SelectField label={label} onChange={setSelectedEpisodeId} value={selectedEpisodeId}>
        <option value="">请选择剧集</option>
        {episodes.map((episode) => (
          <option key={episode.id} value={episode.id}>
            第{episode.episodeNumber}集 · {episode.title}
          </option>
        ))}
      </SelectField>
    );
  }

  if (loading) {
    return (
      <section className="grid min-h-[75vh] place-items-center px-6 pt-12">
        <div className="text-center text-stone-400">
          <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 animate-spin text-cyan-200" />
          <p className="mt-4 text-sm">正在载入生产工作台…</p>
        </div>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="mx-auto min-h-[70vh] max-w-3xl px-6 pb-24 pt-16">
        <div className={cn(panelClass, "p-8 text-center")}>
          <CircleAlert className="mx-auto h-10 w-10 text-red-200" />
          <h1 className="mt-5 text-2xl font-semibold">项目无法打开</h1>
          <p className="mt-3 text-sm text-stone-400">{error || "项目不存在或当前账号无权访问。"}</p>
          <Link className="mt-6 inline-flex items-center gap-2 text-sm text-cyan-200" href="/projects">
            <ArrowLeft className="h-4 w-4" /> 返回我的项目
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen overflow-hidden pb-28 pt-8">
      <div className="cinema-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="pointer-events-none absolute left-[-12rem] top-20 h-[28rem] w-[28rem] rounded-full bg-cyan-500/8 blur-3xl" />
      <div className="relative mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center gap-4 border-b border-white/10 pb-5">
          <Link
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-stone-500 transition hover:text-cyan-100"
            href="/projects"
          >
            <ArrowLeft className="h-4 w-4" /> 返回
          </Link>
          <span className="h-6 w-px bg-white/10" />
          <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-stone-50 sm:text-2xl">
            {project.name}
          </h1>
          <span className="ml-auto shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-xs font-semibold text-cyan-100">
            {project.aspectRatio}
          </span>
        </div>

        <div className="mt-7 grid gap-7 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className={cn(panelClass, "h-fit p-2 xl:sticky xl:top-20")}>
            <nav aria-label="项目生产模块" className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition",
                      activeTab === tab.id
                        ? "bg-cyan-200 text-slate-950"
                        : "text-stone-400 hover:bg-white/7 hover:text-stone-100"
                    )}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                    {tab.id === "jobs" && jobs.length ? (
                      <span className="ml-auto text-[11px] opacity-70">{jobs.length}</span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 space-y-5">
            {error ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-300/20 bg-red-300/8 px-4 py-3 text-sm text-red-100">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button aria-label="关闭错误提示" onClick={() => setError("")} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {message ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-4 py-3 text-sm leading-6 text-emerald-100">
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{message}</span>
                <button aria-label="关闭成功提示" onClick={() => setMessage("")} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {activeTab === "overview" ? (
              <div className="space-y-6">
                <section className={cn(panelClass, "overflow-hidden")}>
                  <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">
                        EPISODE CONTROL
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-stone-50">剧集列表</h2>
                      <p className="mt-1 text-sm text-stone-500">
                        {episodes.length
                          ? `${episodes.length} 集内容正在生产，选择剧集进入完整编辑。`
                          : "从导入、AI 辅助或手动创建开始第一集。"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => startEpisodeDraft("import")}>
                        <Layers3 className="h-4 w-4" /> 导入剧本
                      </ActionButton>
                      <ActionButton onClick={() => startEpisodeDraft("ai")}>
                        <Sparkles className="h-4 w-4" /> AI 剧本创作
                      </ActionButton>
                      <ActionButton onClick={() => openDetailedTab("episodes")} tone="primary">
                        剧集管理 <ChevronRight className="h-4 w-4" />
                      </ActionButton>
                    </div>
                  </div>
                  {episodes.length ? (
                    <div className="flex gap-4 overflow-x-auto p-5 sm:p-6">
                      {episodes.map((episode) => {
                        const episodeBoards = storyboards.filter(
                          (board) => board.episodeId === episode.id
                        );
                        const episodeVoices = voiceovers.filter(
                          (voiceover) => voiceover.episodeId === episode.id
                        );

                        return (
                          <button
                            aria-pressed={selectedEpisodeId === episode.id}
                            className={cn(
                              "group min-w-[250px] max-w-[250px] overflow-hidden rounded-2xl border bg-black/25 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-cyan-200/[0.05]",
                              selectedEpisodeId === episode.id
                                ? "border-cyan-200/55 shadow-[0_15px_45px_rgba(34,211,238,0.1)]"
                                : "border-white/10"
                            )}
                            key={episode.id}
                            onClick={() => setSelectedEpisodeId(episode.id)}
                            type="button"
                          >
                            <div className="relative h-28 overflow-hidden bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,0.18),transparent_35%),linear-gradient(135deg,#15202e,#070b11)] p-4">
                              <span className="text-4xl font-semibold tracking-[-0.08em] text-white/10">
                                EP.{String(episode.episodeNumber).padStart(2, "0")}
                              </span>
                              <span className="absolute bottom-3 left-4 text-xs font-semibold text-cyan-100">
                                第 {episode.episodeNumber} 集
                              </span>
                              <span className="absolute bottom-3 right-3">
                                <StatusBadge status={episode.status} />
                              </span>
                            </div>
                            <div className="p-4">
                              <h3 className="truncate text-sm font-semibold text-stone-100">
                                {episode.title}
                              </h3>
                              <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-stone-500">
                                {episode.summary || "尚未填写本集摘要"}
                              </p>
                              <div className="mt-3 flex items-center justify-between text-[11px] text-stone-600">
                                <span>{episodeBoards.length} 个分镜</span>
                                <span>{episodeVoices.length} 条配音</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 sm:p-6">
                      <button
                        className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] text-sm text-stone-500 transition hover:border-cyan-200/35 hover:text-cyan-100"
                        onClick={() => startEpisodeDraft("manual")}
                        type="button"
                      >
                        <Layers3 className="mb-3 h-7 w-7" />
                        创建第一集
                      </button>
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">
                        ASSET LIBRARY
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-stone-50">
                        角色 · 场景 · 道具
                      </h2>
                    </div>
                    <ActionButton
                      onClick={() => setProjectEditorOpen((current) => !current)}
                    >
                      <Pencil className="h-4 w-4" /> 项目信息
                    </ActionButton>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    {(["role", "scene", "prop"] as const).map((kind) => {
                      const kindElements = elements.filter((element) => element.kind === kind);

                      return (
                        <div className={cn(panelClass, "overflow-hidden")} key={kind}>
                          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
                            <div>
                              <p className="font-semibold text-stone-100">
                                {elementKindLabels[kind]}
                              </p>
                              <p className="mt-1 text-xs text-stone-600">
                                {kindElements.length} 项资产
                              </p>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                className="rounded-lg border border-white/10 px-2.5 py-2 text-xs text-stone-400 transition hover:border-cyan-200/30 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                                disabled={saving || !kindElements.length}
                                onClick={() => void queueElementBatch(kind)}
                                type="button"
                              >
                                批量生图
                              </button>
                              <button
                                className="rounded-lg bg-cyan-200 px-2.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-white"
                                onClick={() => {
                                  setEditingElementId("");
                                  setElementFilter(kind);
                                  setElementDraft({ ...emptyElementDraft(), kind });
                                  openDetailedTab("elements");
                                }}
                                type="button"
                              >
                                创建
                              </button>
                              <button
                                className="rounded-lg border border-white/10 px-2.5 py-2 text-xs text-stone-400 transition hover:border-white/20 hover:text-white"
                                onClick={() => {
                                  setElementFilter(kind);
                                  openDetailedTab("elements");
                                }}
                                type="button"
                              >
                                管理
                              </button>
                            </div>
                          </div>
                          {kindElements.length ? (
                            <div className="grid grid-cols-2 gap-2 p-3">
                              {kindElements.slice(0, 6).map((element) => (
                                <button
                                  className="group overflow-hidden rounded-xl border border-white/8 bg-black/25 text-left transition hover:border-cyan-200/30"
                                  key={element.id}
                                  onClick={() => {
                                    setActiveTab("elements");
                                    editElement(element);
                                  }}
                                  type="button"
                                >
                                  <div
                                    className={cn(
                                      "relative aspect-[1.45/1] bg-cover bg-center",
                                      !element.referenceImageUrl &&
                                        "bg-[linear-gradient(135deg,#17212d,#0a0e14)]"
                                    )}
                                    style={
                                      element.referenceImageUrl
                                        ? {
                                            backgroundImage: `url('${element.referenceImageUrl}')`
                                          }
                                        : undefined
                                    }
                                  >
                                    {!element.referenceImageUrl ? (
                                      <Boxes className="absolute left-3 top-3 h-5 w-5 text-stone-600" />
                                    ) : null}
                                    <span className="absolute bottom-2 right-2">
                                      <StatusBadge status={element.status} />
                                    </span>
                                  </div>
                                  <div className="p-3">
                                    <p className="truncate text-xs font-semibold text-stone-100">
                                      {element.name}
                                    </p>
                                    <p className="mt-1 line-clamp-1 text-[11px] text-stone-600">
                                      {element.description || element.prompt || "待补设定"}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <button
                              className="m-3 flex min-h-32 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-stone-600 transition hover:border-cyan-200/30 hover:text-cyan-100"
                              onClick={() => {
                                setEditingElementId("");
                                setElementDraft({ ...emptyElementDraft(), kind });
                                openDetailedTab("elements");
                              }}
                              type="button"
                            >
                              创建第一个{elementKindLabels[kind]}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className={cn(panelClass, "overflow-hidden")}>
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">
                        STORYBOARD
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-stone-50">
                        本集分镜
                        {selectedEpisode ? (
                          <span className="ml-2 text-sm font-normal text-stone-500">
                            第 {selectedEpisode.episodeNumber} 集
                          </span>
                        ) : null}
                      </h2>
                    </div>
                    <ActionButton onClick={() => openDetailedTab("storyboards")}>
                      分镜管理 <ChevronRight className="h-4 w-4" />
                    </ActionButton>
                  </div>
                  {selectedBoards.length ? (
                    <div className="flex gap-4 overflow-x-auto p-5 sm:p-6">
                      {selectedBoards.slice(0, 20).map((board) => {
                        const episode = episodes.find((item) => item.id === board.episodeId);

                        return (
                          <button
                            className="group min-w-[220px] max-w-[220px] overflow-hidden rounded-2xl border border-white/10 bg-black/25 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/35"
                            key={board.id}
                            onClick={() => {
                              setActiveTab("storyboards");
                              editStoryboard(board);
                            }}
                            type="button"
                          >
                            <div
                              className={cn(
                                "relative aspect-video bg-cover bg-center",
                                !board.imageUrl &&
                                  "bg-[radial-gradient(circle_at_72%_24%,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,#161f2b,#090d13)]"
                              )}
                              style={
                                board.imageUrl
                                  ? { backgroundImage: `url('${board.imageUrl}')` }
                                  : undefined
                              }
                            >
                              <span className="absolute left-3 top-3 rounded-md bg-black/65 px-2 py-1 text-[11px] font-semibold text-cyan-100">
                                SHOT {String(board.shotNumber).padStart(3, "0")}
                              </span>
                              <span className="absolute bottom-3 right-3">
                                <StatusBadge status={board.status} />
                              </span>
                            </div>
                            <div className="p-4">
                              <h3 className="truncate text-sm font-semibold text-stone-100">
                                {board.title}
                              </h3>
                              <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-stone-500">
                                {board.prompt || "尚未填写画面提示词"}
                              </p>
                              <p className="mt-3 text-[11px] text-stone-600">
                                {episode ? `第 ${episode.episodeNumber} 集` : "未分配剧集"} ·{" "}
                                {(board.durationMs / 1000).toFixed(1)}s
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-5 sm:p-6">
                      <EmptyState>还没有分镜，进入分镜管理创建第一组镜头。</EmptyState>
                    </div>
                  )}
                </section>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className={cn(panelClass, "overflow-hidden")}>
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">
                          VOICE PROGRESS
                        </p>
                        <h2 className="mt-2 text-lg font-semibold text-stone-50">
                          配音剧集进度
                        </h2>
                      </div>
                      <ActionButton onClick={() => openDetailedTab("voiceovers")}>
                        配音管理
                      </ActionButton>
                    </div>
                    <div className="divide-y divide-white/8">
                      {episodes.length ? (
                        episodes.map((episode) => {
                          const episodeVoices = voiceovers.filter(
                            (voiceover) => voiceover.episodeId === episode.id
                          );
                          const completed = episodeVoices.filter(
                            (voiceover) =>
                              Boolean(voiceover.audioUrl) || voiceover.status === "completed"
                          ).length;
                          const progress = episodeVoices.length
                            ? Math.round((completed / episodeVoices.length) * 100)
                            : 0;

                          return (
                            <button
                              className="block w-full px-5 py-4 text-left transition hover:bg-white/[0.035]"
                              key={episode.id}
                              onClick={() => openDetailedTab("voiceovers", episode.id)}
                              type="button"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-sm font-semibold text-stone-200">
                                  第 {episode.episodeNumber} 集 · {episode.title}
                                </span>
                                <span className="shrink-0 text-xs text-stone-500">
                                  {completed}/{episodeVoices.length}
                                </span>
                              </div>
                              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-5 text-sm text-stone-600">创建剧集后查看配音进度。</div>
                      )}
                    </div>
                  </section>

                  <section className={cn(panelClass, "overflow-hidden")}>
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">
                          COMPOSITION STATUS
                        </p>
                        <h2 className="mt-2 text-lg font-semibold text-stone-50">
                          分镜合成状态
                        </h2>
                      </div>
                      <ActionButton onClick={() => openDetailedTab("composition")}>
                        合成管理
                      </ActionButton>
                    </div>
                    <div className="divide-y divide-white/8">
                      {episodes.length ? (
                        episodes.map((episode) => {
                          const episodeComposition = compositionsByEpisode[episode.id];
                          const episodeBoards = storyboards.filter(
                            (board) => board.episodeId === episode.id
                          );

                          return (
                            <button
                              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.035]"
                              key={episode.id}
                              onClick={() => openDetailedTab("composition", episode.id)}
                              type="button"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-stone-200">
                                  第 {episode.episodeNumber} 集 · {episode.title}
                                </span>
                                <span className="mt-1 block text-xs text-stone-600">
                                  {episodeBoards.length} 个镜头
                                  {episodeComposition
                                    ? ` · 版本 r${episodeComposition.revision}`
                                    : " · 尚未建立合成工程"}
                                </span>
                              </span>
                              {episodeComposition ? (
                                <StatusBadge status={episodeComposition.status} />
                              ) : (
                                <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-stone-500">
                                  未开始
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-5 text-sm text-stone-600">创建剧集后建立合成工程。</div>
                      )}
                    </div>
                  </section>
                </div>

                {projectEditorOpen ? (
                  <form
                    className={cn(panelClass, "space-y-6 p-5 sm:p-7")}
                    onSubmit={saveProject}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">
                          PROJECT SETTINGS
                        </p>
                        <h2 className="mt-2 text-xl font-semibold">项目信息</h2>
                      </div>
                      <button
                        aria-label="收起项目信息"
                        className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-stone-400 hover:bg-white/8"
                        onClick={() => setProjectEditorOpen(false)}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      <TextField
                        label="项目名称"
                        onChange={(value) => setProject({ ...project, name: value })}
                        required
                        value={project.name}
                      />
                      <TextField
                        label="项目类型"
                        onChange={(value) => setProject({ ...project, type: value })}
                        value={project.type}
                      />
                      <SelectField
                        label="画面比例"
                        onChange={(value) => setProject({ ...project, aspectRatio: value })}
                        value={project.aspectRatio}
                      >
                        {["16:9", "9:16", "21:9", "4:3", "3:4", "1:1"].map(
                          (ratio) => (
                            <option key={ratio} value={ratio}>
                              {ratio}
                            </option>
                          )
                        )}
                      </SelectField>
                      <TextField
                        label="交付物（用顿号或逗号分隔）"
                        onChange={(value) =>
                          setProject({
                            ...project,
                            deliverables: value
                              .split(/[、,，]/)
                              .map((item) => item.trim())
                              .filter(Boolean)
                          })
                        }
                        value={project.deliverables.join("、")}
                      />
                    </div>
                    <TextArea
                      label="素材来源"
                      onChange={(value) => setProject({ ...project, source: value })}
                      value={project.source}
                    />
                    <TextArea
                      label="生产目标"
                      onChange={(value) => setProject({ ...project, goal: value })}
                      value={project.goal}
                    />
                    <TextArea
                      label="统一视觉风格"
                      onChange={(value) => setProject({ ...project, style: value })}
                      value={project.style}
                    />
                    <div className="flex justify-end">
                      <ActionButton disabled={saving} tone="primary" type="submit">
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}{" "}
                        保存项目
                      </ActionButton>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}

            {activeTab === "episodes" ? (
              <>
                <form className={cn(panelClass, "space-y-5 p-5 sm:p-7")} onSubmit={saveEpisode}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">SCRIPT</p>
                      <h2 className="mt-2 text-2xl font-semibold">{editingEpisodeId ? "编辑剧集" : "新建剧集"}</h2>
                    </div>
                    {editingEpisodeId ? (
                      <ActionButton onClick={() => { setEditingEpisodeId(""); setEpisodeDraft({ ...emptyEpisodeDraft(), episodeNumber: episodes.length + 1 }); }}>
                        <X className="h-4 w-4" /> 取消编辑
                      </ActionButton>
                    ) : null}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <TextField label="集数" onChange={(value) => setEpisodeDraft({ ...episodeDraft, episodeNumber: Number(value) || 1 })} type="number" value={episodeDraft.episodeNumber} />
                    <TextField label="标题" onChange={(value) => setEpisodeDraft({ ...episodeDraft, title: value })} required value={episodeDraft.title} />
                    <SelectField label="状态" onChange={(value) => setEpisodeDraft({ ...episodeDraft, status: value as Episode["status"] })} value={episodeDraft.status}>
                      <option value="draft">草稿</option><option value="ready">可生产</option><option value="locked">已锁定</option><option value="archived">已归档</option>
                    </SelectField>
                  </div>
                  <TextArea label="本集摘要" onChange={(value) => setEpisodeDraft({ ...episodeDraft, summary: value })} rows={3} value={episodeDraft.summary} />
                  <TextArea label="完整剧本" onChange={(value) => setEpisodeDraft({ ...episodeDraft, script: value })} placeholder="粘贴或编写本集剧本…" rows={12} value={episodeDraft.script} />
                  <div className="flex justify-end"><ActionButton disabled={saving} tone="primary" type="submit"><Save className="h-4 w-4" /> {editingEpisodeId ? "保存剧集" : "创建剧集"}</ActionButton></div>
                </form>
                <div className="grid gap-4">
                  {episodes.length ? episodes.map((episode) => (
                    <article className={cn(panelClass, "p-5")} key={episode.id}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-cyan-200">EP.{String(episode.episodeNumber).padStart(2, "0")}</span><StatusBadge status={episode.status} /></div>
                          <h3 className="mt-3 text-lg font-semibold">{episode.title}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-7 text-stone-500">{episode.summary || "尚未填写摘要"}</p>
                          <p className="mt-3 text-xs text-stone-600">{episode.script.length.toLocaleString()} 字符 · 更新 {formatDate(episode.updatedAt)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ActionButton disabled={saving} onClick={() => void queueJob({ episodeId: episode.id, resourceId: episode.id, resourceType: "episode", taskType: "script_analysis" })}><Sparkles className="h-4 w-4" /> 分析入队</ActionButton>
                          <ActionButton onClick={() => editEpisode(episode)}><Pencil className="h-4 w-4" /> 编辑</ActionButton>
                          <ActionButton onClick={() => void removeEpisode(episode)} tone="danger"><Trash2 className="h-4 w-4" /> 删除</ActionButton>
                        </div>
                      </div>
                    </article>
                  )) : <EmptyState>还没有剧集。先创建第一集，后续元素、分镜、配音和合成都将关联到它。</EmptyState>}
                </div>
              </>
            ) : null}

            {activeTab === "elements" ? (
              <>
                <form className={cn(panelClass, "space-y-5 p-5 sm:p-7")} onSubmit={saveElement}>
                  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">ELEMENT LIBRARY</p><h2 className="mt-2 text-2xl font-semibold">{editingElementId ? "编辑生产元素" : "新增角色 / 场景 / 道具"}</h2></div>{editingElementId ? <ActionButton onClick={() => { setEditingElementId(""); setElementDraft(emptyElementDraft()); }}><X className="h-4 w-4" /> 取消编辑</ActionButton> : null}</div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    <SelectField label="类型" onChange={(value) => setElementDraft({ ...elementDraft, kind: value as ProductionElement["kind"] })} value={elementDraft.kind}><option value="role">角色</option><option value="scene">场景</option><option value="prop">道具</option></SelectField>
                    <TextField label="名称" onChange={(value) => setElementDraft({ ...elementDraft, name: value })} required value={elementDraft.name} />
                    <SelectField label="适用范围" onChange={(value) => setElementDraft({ ...elementDraft, episodeId: value })} value={elementDraft.episodeId}><option value="">全项目通用</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>第{episode.episodeNumber}集</option>)}</SelectField>
                    <SelectField label="状态" onChange={(value) => setElementDraft({ ...elementDraft, status: value as ProductionStatus })} value={elementDraft.status}><option value="draft">草稿</option><option value="ready">可生产</option><option value="completed">已完成</option><option value="archived">已归档</option></SelectField>
                  </div>
                  <TextField label="别名（用顿号或逗号分隔）" onChange={(value) => setElementDraft({ ...elementDraft, aliases: value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean) })} value={elementDraft.aliases.join("、")} />
                  <TextArea label="设定描述" onChange={(value) => setElementDraft({ ...elementDraft, description: value })} value={elementDraft.description} />
                  <TextArea label="视觉提示词" onChange={(value) => setElementDraft({ ...elementDraft, prompt: value })} rows={5} value={elementDraft.prompt} />
                  <div className="grid gap-5 md:grid-cols-2"><TextField label="参考图地址" onChange={(value) => setElementDraft({ ...elementDraft, referenceImageUrl: value })} type="url" value={elementDraft.referenceImageUrl} /><TextField label="制作备注" onChange={(value) => setElementDraft({ ...elementDraft, notes: value })} value={elementDraft.notes} /></div>
                  <div className="flex justify-end"><ActionButton disabled={saving || !episodes.length && Boolean(elementDraft.episodeId)} tone="primary" type="submit"><Save className="h-4 w-4" /> 保存元素</ActionButton></div>
                </form>
                <div className="flex flex-wrap gap-2">{(["all", "role", "scene", "prop"] as const).map((kind) => <button className={cn("rounded-full border px-4 py-2 text-xs font-semibold transition", elementFilter === kind ? "border-cyan-200/30 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/5 text-stone-400 hover:text-stone-100")} key={kind} onClick={() => setElementFilter(kind)} type="button">{kind === "all" ? `全部 ${elements.length}` : `${elementKindLabels[kind]} ${elements.filter((item) => item.kind === kind).length}`}</button>)}</div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {visibleElements.length ? visibleElements.map((element) => (
                    <article className={cn(panelClass, "p-5")} key={element.id}>
                      <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-cyan-200">{elementKindLabels[element.kind]}</span><StatusBadge status={element.status} /></div><h3 className="mt-3 text-lg font-semibold">{element.name}</h3></div><span className="text-[11px] text-stone-600">{compactId(element.id)}</span></div>
                      <p className="mt-3 line-clamp-3 text-sm leading-7 text-stone-500">{element.description || element.prompt || "尚未填写设定"}</p>
                      {element.aliases.length ? <p className="mt-3 text-xs text-stone-600">别名：{element.aliases.join("、")}</p> : null}
                      <div className="mt-5 flex flex-wrap gap-2"><ActionButton disabled={saving} onClick={() => void queueJob({ episodeId: element.episodeId, resourceId: element.id, resourceType: "element", taskType: "element_image" })}><Sparkles className="h-4 w-4" /> 图像入队</ActionButton><ActionButton onClick={() => editElement(element)}><Pencil className="h-4 w-4" /> 编辑</ActionButton><ActionButton onClick={() => void removeElement(element)} tone="danger"><Trash2 className="h-4 w-4" /> 删除</ActionButton></div>
                    </article>
                  )) : <div className="lg:col-span-2"><EmptyState>当前筛选下还没有生产元素。</EmptyState></div>}
                </div>
              </>
            ) : null}

            {activeTab === "storyboards" ? (
              <>
                <form className={cn(panelClass, "space-y-5 p-5 sm:p-7")} onSubmit={saveStoryboard}>
                  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">STORYBOARD</p><h2 className="mt-2 text-2xl font-semibold">{editingStoryboardId ? "编辑分镜" : "新增分镜"}</h2></div>{editingStoryboardId ? <ActionButton onClick={() => { setEditingStoryboardId(""); setStoryboardDraft({ ...emptyStoryboardDraft(), episodeId: selectedEpisodeId, shotNumber: selectedBoards.length + 1 }); }}><X className="h-4 w-4" /> 取消编辑</ActionButton> : null}</div>
                  {!episodes.length ? <div className="rounded-xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">请先在“剧集”模块创建剧集，再添加分镜。</div> : null}
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="所属剧集" onChange={(value) => { setStoryboardDraft({ ...storyboardDraft, episodeId: value, shotNumber: storyboards.filter((item) => item.episodeId === value).length + 1, elementIds: [] }); setSelectedEpisodeId(value); }} value={storyboardDraft.episodeId}><option value="">请选择剧集</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>第{episode.episodeNumber}集 · {episode.title}</option>)}</SelectField><TextField label="镜号" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, shotNumber: Number(value) || 1 })} type="number" value={storyboardDraft.shotNumber} /><TextField label="分镜标题" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, title: value })} required value={storyboardDraft.title} /><TextField label="时长（毫秒）" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, durationMs: Number(value) || 200 })} type="number" value={storyboardDraft.durationMs} /></div>
                  <div className="grid gap-5 md:grid-cols-2"><TextArea label="画面提示词" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, prompt: value })} rows={6} value={storyboardDraft.prompt} /><TextArea label="负面提示词" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, negativePrompt: value })} rows={6} value={storyboardDraft.negativePrompt} /></div>
                  <div className="grid gap-5 md:grid-cols-2"><TextArea label="镜头 / 运镜" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, camera: value })} rows={3} value={storyboardDraft.camera} /><TextArea label="台词" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, dialogue: value })} rows={3} value={storyboardDraft.dialogue} /></div>
                  <Field label="引用生产元素"><div className="mt-2 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2 lg:grid-cols-3">{availableElements.length ? availableElements.map((element) => <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-stone-300 hover:bg-white/5" key={element.id}><input checked={storyboardDraft.elementIds.includes(element.id)} onChange={(event) => setStoryboardDraft({ ...storyboardDraft, elementIds: event.target.checked ? [...storyboardDraft.elementIds, element.id] : storyboardDraft.elementIds.filter((id) => id !== element.id) })} type="checkbox" /><span>{elementKindLabels[element.kind]} · {element.name}</span></label>) : <span className="px-2 py-3 text-xs text-stone-600">没有可引用元素</span>}</div></Field>
                  <div className="grid gap-5 md:grid-cols-3"><TextField label="参考图地址" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, referenceImageUrl: value })} type="url" value={storyboardDraft.referenceImageUrl} /><TextField label="成品图地址" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, imageUrl: value })} type="url" value={storyboardDraft.imageUrl} /><TextField label="成品视频地址" onChange={(value) => setStoryboardDraft({ ...storyboardDraft, videoUrl: value })} type="url" value={storyboardDraft.videoUrl} /></div>
                  <div className="flex justify-end"><ActionButton disabled={saving || !storyboardDraft.episodeId} tone="primary" type="submit"><Save className="h-4 w-4" /> 保存分镜</ActionButton></div>
                </form>
                <div className={cn(panelClass, "p-5")}><div className="max-w-sm">{renderEpisodeSelector("查看剧集")}</div></div>
                <div className="grid gap-4">
                  {selectedBoards.length ? selectedBoards.map((board) => (
                    <article className={cn(panelClass, "p-5")} key={board.id}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-cyan-200">SHOT {String(board.shotNumber).padStart(3, "0")}</span><StatusBadge status={board.status} /><span className="text-xs text-stone-600">{(board.durationMs / 1000).toFixed(1)}s</span></div><h3 className="mt-3 text-lg font-semibold">{board.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-7 text-stone-500">{board.prompt || "尚未填写画面提示词"}</p>{board.dialogue ? <p className="mt-3 border-l border-cyan-300/30 pl-3 text-sm text-stone-400">“{board.dialogue}”</p> : null}</div><div className="flex max-w-lg flex-wrap gap-2"><ActionButton disabled={saving} onClick={() => void queueJob({ episodeId: board.episodeId, resourceId: board.id, resourceType: "storyboard", taskType: "storyboard_image" })}><Sparkles className="h-4 w-4" /> 图片入队</ActionButton><ActionButton disabled={saving} onClick={() => void queueJob({ episodeId: board.episodeId, resourceId: board.id, resourceType: "storyboard", taskType: "storyboard_video" })}><Film className="h-4 w-4" /> 视频入队</ActionButton><ActionButton onClick={() => editStoryboard(board)}><Pencil className="h-4 w-4" /> 编辑</ActionButton><ActionButton onClick={() => void removeStoryboard(board)} tone="danger"><Trash2 className="h-4 w-4" /> 删除</ActionButton></div></div></article>
                  )) : <EmptyState>{selectedEpisode ? `「${selectedEpisode.title}」还没有分镜。` : "选择剧集后查看分镜。"}</EmptyState>}
                </div>
              </>
            ) : null}

            {activeTab === "voiceovers" ? (
              <>
                <form className={cn(panelClass, "space-y-5 p-5 sm:p-7")} onSubmit={saveVoiceover}>
                  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">VOICE</p><h2 className="mt-2 text-2xl font-semibold">{editingVoiceoverId ? "编辑配音条目" : "新增配音条目"}</h2></div>{editingVoiceoverId ? <ActionButton onClick={() => { setEditingVoiceoverId(""); setVoiceoverDraft({ ...emptyVoiceoverDraft(), episodeId: selectedEpisodeId }); }}><X className="h-4 w-4" /> 取消编辑</ActionButton> : null}</div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="所属剧集" onChange={(value) => { setVoiceoverDraft({ ...voiceoverDraft, episodeId: value, storyboardId: "", roleElementId: "" }); setSelectedEpisodeId(value); }} value={voiceoverDraft.episodeId}><option value="">请选择剧集</option>{episodes.map((episode) => <option key={episode.id} value={episode.id}>第{episode.episodeNumber}集 · {episode.title}</option>)}</SelectField><SelectField label="关联分镜（可选）" onChange={(value) => setVoiceoverDraft({ ...voiceoverDraft, storyboardId: value })} value={voiceoverDraft.storyboardId}><option value="">不关联分镜</option>{storyboards.filter((board) => board.episodeId === voiceoverDraft.episodeId).map((board) => <option key={board.id} value={board.id}>镜{board.shotNumber} · {board.title}</option>)}</SelectField><SelectField label="说话角色（可选）" onChange={(value) => { const role = elements.find((element) => element.id === value); setVoiceoverDraft({ ...voiceoverDraft, roleElementId: value, speakerName: role?.name ?? voiceoverDraft.speakerName }); }} value={voiceoverDraft.roleElementId}><option value="">不关联角色</option>{elements.filter((element) => element.kind === "role" && (!element.episodeId || element.episodeId === voiceoverDraft.episodeId)).map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}</SelectField><TextField label="说话人显示名" onChange={(value) => setVoiceoverDraft({ ...voiceoverDraft, speakerName: value })} value={voiceoverDraft.speakerName} /></div>
                  <TextArea label="台词" onChange={(value) => setVoiceoverDraft({ ...voiceoverDraft, lineText: value })} rows={5} value={voiceoverDraft.lineText} />
                  <div className="grid gap-5 md:grid-cols-3"><TextField label="音色 ID（可选）" onChange={(value) => setVoiceoverDraft({ ...voiceoverDraft, voiceProfileId: value })} value={voiceoverDraft.voiceProfileId} /><TextField label="音频地址（生成后回填）" onChange={(value) => setVoiceoverDraft({ ...voiceoverDraft, audioUrl: value })} type="url" value={voiceoverDraft.audioUrl} /><TextField label="时长（毫秒）" onChange={(value) => setVoiceoverDraft({ ...voiceoverDraft, durationMs: Number(value) || 0 })} type="number" value={voiceoverDraft.durationMs} /></div>
                  <div className="flex justify-end"><ActionButton disabled={saving || !voiceoverDraft.episodeId || !voiceoverDraft.lineText.trim()} tone="primary" type="submit"><Save className="h-4 w-4" /> 保存配音</ActionButton></div>
                </form>
                <div className={cn(panelClass, "p-5")}><div className="max-w-sm">{renderEpisodeSelector("查看剧集")}</div></div>
                <div className="grid gap-4">
                  {selectedVoiceovers.length ? selectedVoiceovers.map((voiceover) => (
                    <article className={cn(panelClass, "p-5")} key={voiceover.id}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-cyan-200">{voiceover.speakerName || "旁白"}</span><StatusBadge status={voiceover.status} />{voiceover.durationMs ? <span className="text-xs text-stone-600">{(voiceover.durationMs / 1000).toFixed(1)}s</span> : null}</div><p className="mt-3 text-sm leading-7 text-stone-300">{voiceover.lineText}</p><p className="mt-3 text-xs text-stone-600">音色：{voiceover.voiceProfileId || "未指定"} · 音频：{voiceover.audioUrl ? "已回填" : "待生成"}</p></div><div className="flex flex-wrap gap-2"><ActionButton disabled={saving} onClick={() => void queueJob({ episodeId: voiceover.episodeId, resourceId: voiceover.id, resourceType: "voiceover", taskType: "voiceover_audio" })}><Mic2 className="h-4 w-4" /> 配音入队</ActionButton><ActionButton onClick={() => editVoiceover(voiceover)}><Pencil className="h-4 w-4" /> 编辑</ActionButton><ActionButton onClick={() => void removeVoiceover(voiceover)} tone="danger"><Trash2 className="h-4 w-4" /> 删除</ActionButton></div></div></article>
                  )) : <EmptyState>{selectedEpisode ? `「${selectedEpisode.title}」还没有配音条目。` : "选择剧集后查看配音。"}</EmptyState>}
                </div>
              </>
            ) : null}

            {activeTab === "composition" ? (
              <form className={cn(panelClass, "space-y-6 p-5 sm:p-7")} onSubmit={saveComposition}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">COMPOSITION</p><h2 className="mt-2 text-2xl font-semibold">合成工程</h2><p className="mt-2 text-sm leading-7 text-stone-500">时间线采用版本号并发控制，避免多个窗口互相覆盖。</p></div><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-stone-400">当前版本 <span className="font-semibold text-cyan-100">r{compositionRevision}</span></div></div>
                <div className="max-w-md">{renderEpisodeSelector()}</div>
                {!selectedEpisodeId ? <EmptyState>先选择一个剧集，再建立合成工程。</EmptyState> : <>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="画面比例" onChange={setCompositionRatio} value={compositionRatio}>{["16:9", "9:16", "21:9", "4:3", "3:4", "1:1"].map((ratio) => <option key={ratio} value={ratio}>{ratio}</option>)}</SelectField><SelectField label="分辨率" onChange={setCompositionResolution} value={compositionResolution}><option value="1920x1080">1920×1080</option><option value="1080x1920">1080×1920</option><option value="3840x2160">3840×2160</option><option value="2160x3840">2160×3840</option></SelectField><SelectField label="适配方式" onChange={setCompositionFit} value={compositionFit}><option value="cover">填满裁切</option><option value="contain">完整显示</option><option value="stretch">拉伸填满</option></SelectField><SelectField label="默认转场" onChange={setCompositionTransition} value={compositionTransition}><option value="cut">硬切</option><option value="dissolve">叠化</option><option value="fade">淡入淡出</option></SelectField></div>
                  <div><div className="flex flex-wrap items-end justify-between gap-3"><span className="text-xs font-medium tracking-[0.08em] text-stone-400">时间线 JSON</span><ActionButton onClick={buildTimelineFromResources}><RefreshCw className="h-4 w-4" /> 按本集资源重建</ActionButton></div><textarea className={cn(fieldClass, "font-mono text-xs leading-6")} onChange={(event) => setCompositionTimeline(event.target.value)} rows={18} value={compositionTimeline} /></div>
                  {composition?.outputUrl ? <p className="text-sm text-stone-400">最近输出：<a className="text-cyan-200 hover:underline" href={composition.outputUrl} rel="noreferrer" target="_blank">{composition.outputUrl}</a></p> : null}
                  <div className="flex flex-wrap justify-end gap-3"><ActionButton disabled={saving} tone="primary" type="submit"><Save className="h-4 w-4" /> 保存工程</ActionButton><ActionButton disabled={saving} onClick={() => void queueCompositionExport()}><Film className="h-4 w-4" /> 保存并导出入队</ActionButton></div>
                </>}
              </form>
            ) : null}

            {activeTab === "jobs" ? (
              <div className={cn(panelClass, "overflow-hidden")}>
                <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7"><div><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200">GENERATION QUEUE</p><h2 className="mt-2 text-2xl font-semibold">生成任务</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-stone-500">这里保存真实任务记录。当前按钮只负责入队；未配置模型执行器时，任务会保持 queued，不会展示伪生成结果。</p></div><ActionButton disabled={saving} onClick={() => void loadStudio()}><RefreshCw className="h-4 w-4" /> 刷新</ActionButton></div>
                {jobs.length ? <div className="divide-y divide-white/8">{jobs.map((job) => <article className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6" key={job.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><span className="font-semibold text-stone-100">{taskLabels[job.taskType]}</span><StatusBadge status={job.status} /><span className="text-xs text-stone-600">尝试 {job.attemptCount}</span></div><p className="mt-2 truncate font-mono text-xs text-stone-600">任务 {job.id} · 资源 {job.resourceType}/{job.resourceId}</p>{job.error ? <p className="mt-2 text-sm text-red-200">{job.error}</p> : null}</div><time className="text-xs text-stone-500">{formatDate(job.updatedAt)}</time></article>)}</div> : <div className="p-5 sm:p-7"><EmptyState>还没有生成任务。可在剧集、元素、分镜、配音或合成模块创建真实 queued 任务。</EmptyState></div>}
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </section>
  );
}
