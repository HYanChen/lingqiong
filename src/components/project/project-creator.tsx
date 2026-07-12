"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  Edit3,
  FileJson,
  FileText,
  Film,
  Loader2,
  MoreVertical,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";

import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

const defaultProjectTypeLabels = [
  "战纪宇宙",
  "短剧漫剧",
  "概念预告",
  "文旅宣传",
  "品牌影像"
];

type ProjectTypeOption = {
  active: boolean;
  category: string;
  description: string;
  id: string;
  label: string;
  sortOrder: number;
};

const defaultDeliverables = ["影视大纲", "角色资产库", "分镜", "全能提示词"];

const aspectRatioOptions = [
  { label: "横屏", value: "16:9" },
  { label: "竖屏", value: "9:16" },
  { label: "标准", value: "4:3" },
  { label: "纵向", value: "3:4" },
  { label: "方形", value: "1:1" },
  { label: "电影", value: "21:9" }
] as const;

type AspectRatioValue = (typeof aspectRatioOptions)[number]["value"];

type ExampleProject = {
  deliverables: string[];
  goal: string;
  image: string;
  name: string;
  ratio: "9:16" | "16:9";
  source: string;
  style: string;
  type: string;
};

const exampleProjects: ExampleProject[] = [
  {
    deliverables: ["影视大纲", "分镜", "全能提示词"],
    goal: "从奇遇开场进入都市逆袭线，快速建立主角能力、冲突对象和连续爽点。",
    image: "/media/work-spark.png",
    name: "逆袭之通天财眼",
    ratio: "9:16",
    source: "江州大学贫困生陈凡，在街头意外被濒死校花赵琳的豪车撞飞。",
    style: "都市奇遇、强节奏、金融异能、短剧爽感。",
    type: "短剧漫剧"
  },
  {
    deliverables: ["剧本", "角色资产库", "分镜"],
    goal: "围绕荒诞设定做连续反转，适合测试短剧钩子和人物关系。",
    image: "/media/services-studio.png",
    name: "离谱全县每人每天给我百块!",
    ratio: "9:16",
    source: "上辈打工，内卷到高血压，还存不到钱。睁眼都睁四年，意外绑定县域消费金系统。",
    style: "荒诞现实、县城喜剧、轻悬疑、强钩子。",
    type: "短剧漫剧"
  },
  {
    deliverables: ["影视大纲", "角色资产库", "视频样片"],
    goal: "以群像仙侠和反差人设构建中长线 IP 试验项目。",
    image: "/media/hero-war-chronicle.png",
    name: "这个师兄明明超强却过分谦虚",
    ratio: "16:9",
    source: "陆鸣身穿修仙界，因颜值过硬，被游历道域的仙子苏寒仪捡走，成了天衍宗烟霞峰开山首徒。",
    style: "东方仙侠、轻喜剧、强视觉奇观、群像冒险。",
    type: "概念预告"
  },
  {
    deliverables: ["角色资产库", "场景资产库", "分镜"],
    goal: "做成少年成长、城市记忆和竞技精神结合的系列样板。",
    image: "/media/universe-generations.png",
    name: "中国足球小将",
    ratio: "9:16",
    source: "南方一座三线工业城市，曾经的足球重镇如今青训凋敝，只剩下一所濒临解散的社区业余青训。",
    style: "现实主义、热血成长、城市工业质感。",
    type: "品牌影像"
  },
  {
    deliverables: ["影视大纲", "剧本", "全能提示词"],
    goal: "以家庭空间连通边关战场，测试历史奇幻和女性冒险线。",
    image: "/media/workflow-studio.png",
    name: "我家后墙通边关",
    ratio: "16:9",
    source: "林小满经营的五金店濒临倒闭，某夜后墙忽然走出一位受伤的古代将军顾北。",
    style: "古今互穿、边关战争、家国情绪、女性成长。",
    type: "战纪宇宙"
  }
];

export type CanvasProject = {
  aspectRatio?: string;
  coverImage?: string;
  createdAt: string;
  deliverables: string[];
  goal: string;
  id?: string;
  name: string;
  ownerAccount?: string;
  ownerId?: string;
  source: string;
  style: string;
  type: string;
  updatedAt?: string;
};

type ProjectUpload = {
  createdAt: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  id: string;
  projectId: string;
};

type ExportSectionKey =
  | "project"
  | "episodes"
  | "storyboards"
  | "elements"
  | "voiceovers"
  | "uploads";

const exportSections: Array<{
  endpoint?: string;
  key: ExportSectionKey;
  label: string;
  responseKey?: string;
  summary: string;
}> = [
  {
    key: "project",
    label: "项目资料",
    summary: "名称、描述、比例、风格与基础配置"
  },
  {
    endpoint: "episodes",
    key: "episodes",
    label: "剧集章节",
    responseKey: "episodes",
    summary: "已保存的剧集与章节内容"
  },
  {
    endpoint: "storyboards",
    key: "storyboards",
    label: "分镜数据",
    responseKey: "storyboards",
    summary: "镜头、画面提示词与制作状态"
  },
  {
    endpoint: "elements",
    key: "elements",
    label: "角色与场景",
    responseKey: "elements",
    summary: "人物、场景、道具等项目资产"
  },
  {
    endpoint: "voiceovers",
    key: "voiceovers",
    label: "配音数据",
    responseKey: "voiceovers",
    summary: "旁白、台词与配音记录"
  },
  {
    endpoint: "upload",
    key: "uploads",
    label: "素材清单",
    responseKey: "uploads",
    summary: "项目已上传文件的名称与元数据"
  }
];

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

function projectCover(_index: number, project?: Pick<CanvasProject, "coverImage">) {
  return project?.coverImage || "";
}

function normalizeAspectRatio(value?: string): AspectRatioValue {
  return aspectRatioOptions.some((option) => option.value === value)
    ? (value as AspectRatioValue)
    : "9:16";
}

function projectRatio(
  project: Pick<CanvasProject, "aspectRatio" | "type">,
  index: number
) {
  if (project.aspectRatio) {
    return normalizeAspectRatio(project.aspectRatio);
  }

  if (project.type === "品牌影像" || project.type === "概念预告") {
    return "16:9";
  }

  return index % 5 === 4 ? "16:9" : "9:16";
}

function projectExcerpt(value: string) {
  return value.trim() || "还没有填写项目描述";
}

function safeExportName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\u4e00-\u9fa5\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 70) || "project"
  );
}

function ProjectCard({
  cover,
  onOpen,
  project,
  ratio
}: {
  cover: string;
  onOpen: () => void;
  project: CanvasProject;
  ratio: string;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0b1119] shadow-[0_16px_50px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:border-cyan-200/40 hover:shadow-[0_20px_60px_rgba(43,226,210,0.14)]">
      <button className="block w-full text-left" onClick={onOpen} type="button">
        <div className="relative aspect-video overflow-hidden bg-zinc-900">
          {cover ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url('${cover}')` }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#18212b_0%,#0c131b_52%,#17242a_100%)] text-stone-500 transition duration-300 group-hover:text-stone-300">
              <Film aria-hidden="true" className="h-7 w-7" />
              <span className="text-xs font-medium">暂无封面</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07111e] via-black/10 to-transparent" />
          <span className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/65 px-2 py-1 text-[11px] font-medium text-stone-100 backdrop-blur-md">
            {ratio}
          </span>
        </div>
        <div className="px-4 pb-5 pt-4">
          <h2 className="truncate text-base font-semibold text-stone-50">
            {project.name}
          </h2>
          <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-stone-400">
            {projectExcerpt(project.source || project.goal)}
          </p>
        </div>
      </button>
    </article>
  );
}

function ExampleCard({
  example,
  onCopy,
  saving
}: {
  example: ExampleProject;
  onCopy: () => void;
  saving: boolean;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0b1119] transition duration-300 hover:-translate-y-1 hover:border-cyan-200/35 hover:shadow-[0_18px_55px_rgba(43,226,210,0.1)]">
      <div className="relative aspect-video overflow-hidden bg-zinc-900">
        <div
          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url('${example.image}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111e] via-black/10 to-transparent" />
        <span className="absolute left-3 top-3 rounded-md border border-cyan-100/20 bg-cyan-200/15 px-2 py-1 text-[11px] font-semibold text-cyan-50 backdrop-blur-md">
          示例
        </span>
        <button
          className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-black/65 px-3 text-xs font-semibold text-white backdrop-blur-md transition hover:border-cyan-100/40 hover:bg-cyan-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
          onClick={onCopy}
          type="button"
        >
          {saving ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          复刻
        </button>
        <span className="absolute bottom-3 left-3 rounded-md bg-black/65 px-2 py-1 text-[11px] text-stone-100 backdrop-blur-md">
          {example.ratio}
        </span>
      </div>
      <div className="px-4 pb-5 pt-4">
        <h3 className="truncate text-base font-semibold text-stone-50">
          {example.name}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-stone-400">
          {example.source}
        </p>
      </div>
    </article>
  );
}

export function ProjectCreator() {
  const router = useRouter();
  const [type, setType] = useState(defaultProjectTypeLabels[0]);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [goal, setGoal] = useState("");
  const [style, setStyle] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [deliverables, setDeliverables] = useState(defaultDeliverables);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>("9:16");
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<CanvasProject | null>(null);
  const [activeMenuProjectId, setActiveMenuProjectId] = useState("");
  const [copyingName, setCopyingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadMessage, setCoverUploadMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<CanvasProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportTarget, setExportTarget] = useState<CanvasProject | null>(null);
  const [exportSelection, setExportSelection] = useState<ExportSectionKey[]>(
    exportSections.map((section) => section.key)
  );
  const [exportStatus, setExportStatus] = useState<
    "idle" | "running" | "ready" | "error"
  >("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [exportError, setExportError] = useState("");
  const [exportUrl, setExportUrl] = useState("");
  const [exportFileName, setExportFileName] = useState("");

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProjects = useMemo(
    () => projects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, projects]
  );

  const loadProjects = useCallback(async () => {
    const params = new URLSearchParams({ limit: "80" });

    setProjectsLoading(true);
    setError("");

    try {
      const response = await fetch(`/_wcu-api/projects?${params.toString()}`, {
        cache: "no-store"
      });
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
        ok?: boolean;
        projects?: CanvasProject[];
      };

      if (response.status === 401) {
        window.location.assign("/login?next=/projects");
        return;
      }

      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || "项目列表读取失败。 ");
      }

      setProjects(Array.isArray(result?.projects) ? result.projects : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "项目列表读取失败，请稍后重试。 ");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProjectTypes() {
      try {
        const response = await fetch("/_wcu-api/project-types", { cache: "no-store" });
        const result = (await response.json().catch(() => null)) as null | {
          types?: ProjectTypeOption[];
        };
        const labels = Array.isArray(result?.types)
          ? result.types
              .filter((item) => item.active !== false && item.label?.trim())
              .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder))
              .map((item) => item.label.trim())
          : [];
        const nextLabels = labels.length ? labels : defaultProjectTypeLabels;

        if (!cancelled) {
          setType((current) =>
            nextLabels.includes(current) ? current : nextLabels[0]
          );
        }
      } catch {
        // Keep the initial built-in project type when the optional type API is unavailable.
      }
    }

    void loadProjectTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProjects();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  useEffect(
    () => () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
    },
    [exportUrl]
  );

  function openCreateModal() {
    router.push("/create");
  }

  function closeProjectModal() {
    if (saving || coverUploading) {
      return;
    }

    setCreateOpen(false);
    setEditingProject(null);
    setFormError("");
  }

  function openEditModal(project: CanvasProject) {
    setEditingProject(project);
    setType(project.type);
    setName(project.name);
    setSource(project.source);
    setGoal(project.goal);
    setStyle(project.style);
    setCoverImage(project.coverImage ?? "");
    setDeliverables(project.deliverables.length ? project.deliverables : defaultDeliverables);
    setAspectRatio(normalizeAspectRatio(project.aspectRatio));
    setActiveMenuProjectId("");
    setCoverUploadMessage("");
    setFormError("");
    setCreateOpen(true);
  }

  function openProject(project: CanvasProject) {
    if (!project.id) {
      setError("项目缺少 ID，暂时无法打开。 ");
      return;
    }

    saveCanvasProject(project);
    router.push(`/projects/${project.id}`);
  }

  async function createProject(input: Omit<CanvasProject, "createdAt" | "id">) {
    const localProject = {
      ...input,
      createdAt: new Date().toISOString()
    };

    saveCanvasProject(localProject);

    const response = await fetch("/_wcu-api/projects", {
      body: JSON.stringify(localProject),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const result = (await response.json().catch(() => null)) as null | {
      message?: string;
      ok: boolean;
      project?: CanvasProject;
    };

    if (!response.ok || !result?.project) {
      throw new Error(result?.message ?? "项目保存失败。 ");
    }

    saveCanvasProject(result.project);
    setProjects((current) => [result.project as CanvasProject, ...current]);
    setPage(1);
    return result.project;
  }

  async function updateExistingProject(project: CanvasProject) {
    if (!project.id) {
      throw new Error("项目缺少 ID，无法保存。 ");
    }

    const response = await fetch(`/_wcu-api/projects/${project.id}`, {
      body: JSON.stringify({
        aspectRatio,
        coverImage,
        deliverables,
        goal,
        name: name.trim(),
        source,
        style,
        type
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    const result = (await response.json().catch(() => null)) as null | {
      message?: string;
      ok: boolean;
      project?: CanvasProject;
    };

    if (!response.ok || !result?.project) {
      throw new Error(result?.message ?? "项目保存失败。 ");
    }

    const updatedProject = result.project;
    setProjects((current) =>
      current.map((item) => (item.id === updatedProject.id ? updatedProject : item))
    );
    saveCanvasProject(updatedProject);
    return updatedProject;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setFormError("请填写项目名称。 ");
      return;
    }

    setFormError("");
    setMessage("");
    setSaving(true);

    try {
      if (editingProject) {
        const project = await updateExistingProject(editingProject);

        setMessage(`已保存「${project.name}」。`);
        setCreateOpen(false);
        setEditingProject(null);
        return;
      }

      const project = await createProject({
        aspectRatio,
        coverImage,
        deliverables,
        goal,
        name: name.trim(),
        source,
        style,
        type
      });

      setCreateOpen(false);
      router.push(`/projects/${project.id}`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "项目保存失败。 ");
    } finally {
      setSaving(false);
    }
  }

  async function uploadProjectCover(files: FileList | null) {
    const file = files?.[0];

    if (!file || !editingProject?.id) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFormError("请选择图片格式的封面。 ");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError("封面图片不能超过 10MB。 ");
      return;
    }

    const body = new FormData();
    body.append("files", file);
    setCoverUploading(true);
    setFormError("");
    setCoverUploadMessage("");

    try {
      const response = await fetch(`/_wcu-api/projects/${editingProject.id}/upload`, {
        body,
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
        ok?: boolean;
        uploads?: ProjectUpload[];
      };

      if (response.status === 401) {
        window.location.assign("/login?next=/projects");
        return;
      }

      const upload = result?.uploads?.[0];

      if (!response.ok || !result?.ok || !upload) {
        throw new Error(result?.message || "封面上传失败。 ");
      }

      setCoverImage(`/_wcu-api/projects/${editingProject.id}/uploads/${upload.id}`);
      setCoverUploadMessage("封面已上传，保存修改后正式应用。 ");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "封面上传失败。 ");
    } finally {
      setCoverUploading(false);
    }
  }

  function openExportModal(project: CanvasProject) {
    if (exportUrl) {
      URL.revokeObjectURL(exportUrl);
    }

    setActiveMenuProjectId("");
    setExportTarget(project);
    setExportSelection(exportSections.map((section) => section.key));
    setExportStatus("idle");
    setExportProgress(0);
    setExportLogs([]);
    setExportError("");
    setExportUrl("");
    setExportFileName("");
  }

  function closeExportModal() {
    if (exportStatus === "running") {
      return;
    }

    if (exportUrl) {
      URL.revokeObjectURL(exportUrl);
    }

    setExportTarget(null);
    setExportUrl("");
  }

  function toggleExportSection(key: ExportSectionKey) {
    if (key === "project" || exportStatus === "running") {
      return;
    }

    if (exportUrl) {
      URL.revokeObjectURL(exportUrl);
      setExportUrl("");
    }

    setExportSelection((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
    setExportStatus("idle");
    setExportProgress(0);
    setExportLogs([]);
    setExportError("");
  }

  async function runProjectExport() {
    if (!exportTarget?.id) {
      setExportStatus("error");
      setExportError("项目缺少 ID，无法导出。 ");
      return;
    }

    const selectedSections = exportSections.filter((section) =>
      exportSelection.includes(section.key)
    );

    setExportStatus("running");
    setExportProgress(5);
    setExportLogs(["正在向服务端提交导出任务"]);
    setExportError("");

    try {
      const filename = `${safeExportName(exportTarget.name)}_项目数据.json`;
      const exportParams = new URLSearchParams({
        download: "1",
        sections: selectedSections.map((section) => section.key).join(",")
      });
      const exportResponse = await fetch(
        `/_wcu-api/projects/${exportTarget.id}/export?${exportParams.toString()}`,
        {
          cache: "no-store",
          method: "GET"
        }
      );
      let blob: Blob;

      if (exportResponse.status === 401) {
        window.location.assign("/login?next=/projects");
        return;
      }

      if (exportResponse.status !== 404 && exportResponse.status !== 405) {
        const result = (await exportResponse.clone().json().catch(() => null)) as null | {
          message?: string;
          ok?: boolean;
          sections?: string[];
        };

        if (!exportResponse.ok || result?.ok === false) {
          throw new Error(result?.message || "服务端导出失败。 ");
        }

        setExportProgress(90);
        setExportLogs((current) => [
          ...current,
          `服务端已汇总 ${result?.sections?.length ?? selectedSections.length} 个数据章节`,
          "正在生成下载文件"
        ]);
        blob = await exportResponse.blob();
      } else {
        const payload: Record<string, unknown> = {
          exportedAt: new Date().toISOString(),
          format: "lingqiong-project-export",
          schemaVersion: 1
        };

        setExportLogs((current) => [
          ...current,
          "整包导出服务暂不可用，正在通过兼容接口逐项读取"
        ]);

        for (let index = 0; index < selectedSections.length; index += 1) {
          const section = selectedSections[index];
          setExportLogs((current) => [...current, `正在读取：${section.label}`]);

          if (section.key === "project") {
            payload.project = exportTarget;
          } else {
            const response = await fetch(
              `/_wcu-api/projects/${exportTarget.id}/${section.endpoint}`,
              { cache: "no-store" }
            );
            const result = (await response.json().catch(() => null)) as null | Record<
              string,
              unknown
            >;

            if (response.status === 401) {
              window.location.assign("/login?next=/projects");
              return;
            }

            if (!response.ok) {
              const apiMessage =
                result && typeof result.message === "string"
                  ? result.message
                  : "读取失败";
              throw new Error(`${section.label}：${apiMessage}`);
            }

            payload[section.key] =
              result && section.responseKey && section.responseKey in result
                ? result[section.responseKey]
                : result;
          }

          setExportLogs((current) => [...current, `已完成：${section.label}`]);
          setExportProgress(
            Math.round(((index + 1) / selectedSections.length) * 85) + 5
          );
        }

        blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8"
        });
      }

      const url = URL.createObjectURL(blob);

      setExportFileName(filename);
      setExportUrl(url);
      setExportProgress(100);
      setExportLogs((current) => [...current, `导出文件已生成：${filename}`]);
      setExportStatus("ready");
    } catch (caught) {
      setExportStatus("error");
      setExportError(caught instanceof Error ? caught.message : "项目导出失败。 ");
      setExportLogs((current) => [...current, "导出中断，请根据错误提示重试。"]);
    }
  }

  async function deleteExistingProject() {
    if (!deleteTarget?.id) {
      setError("项目缺少 ID，无法删除。 ");
      return;
    }

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/_wcu-api/projects/${deleteTarget.id}`, {
        method: "DELETE"
      });
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
        ok: boolean;
      };

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message ?? "项目删除失败。 ");
      }

      setProjects((current) => current.filter((item) => item.id !== deleteTarget.id));
      setMessage(`已永久删除「${deleteTarget.name}」。`);
      setDeleteTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "项目删除失败。 ");
    } finally {
      setDeleting(false);
    }
  }

  async function copyExample(example: ExampleProject) {
    setCopyingName(example.name);
    setError("");
    setMessage("");

    try {
      await createProject({
        aspectRatio: example.ratio,
        coverImage: example.image,
        deliverables: example.deliverables,
        goal: example.goal,
        name: example.name,
        source: example.source,
        style: example.style,
        type: example.type
      });
      setMessage(`已复刻「${example.name}」到我的项目。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "示例复刻失败。 ");
    } finally {
      setCopyingName("");
    }
  }

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_85%_0%,rgba(18,114,119,0.12),transparent_28%),#04070b] px-4 pb-20 pt-10 text-stone-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1880px]">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/5 px-3 py-1 text-xs font-medium text-cyan-100">
              <Film aria-hidden="true" className="h-3.5 w-3.5" />
              创作工作台
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              我的项目
            </h1>
            <p className="mt-2 text-sm text-stone-400">管理你的漫剧创作</p>
          </div>
          <button
            className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-[#61eadc] px-5 text-sm font-semibold text-[#04110f] shadow-[0_12px_34px_rgba(54,231,213,0.22)] transition hover:-translate-y-0.5 hover:bg-cyan-100"
            onClick={openCreateModal}
            type="button"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            新建项目
          </button>
        </header>

        {message ? (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-emerald-300/20 bg-emerald-300/8 px-4 py-3 text-sm text-emerald-100">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              {message}
            </span>
            <button aria-label="关闭提示" onClick={() => setMessage("")} type="button">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {error && projects.length > 0 ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300/20 bg-red-300/8 px-4 py-3 text-sm text-red-100">
            <span>{error}</span>
            <button
              className="inline-flex items-center gap-2 font-semibold text-white"
              onClick={() => void loadProjects()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              重试
            </button>
          </div>
        ) : null}

        <div className="mb-4 flex items-center justify-between text-xs text-stone-500">
          <span>{projectsLoading ? "正在同步项目" : `共 ${projects.length} 个项目`}</span>
          {projects.length > PAGE_SIZE ? (
            <span>
              第 {currentPage} / {totalPages} 页
            </span>
          ) : null}
        </div>

        {projectsLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]"
                key={index}
              >
                <div className="aspect-video animate-pulse bg-white/[0.055]" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.07]" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/[0.05]" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!projectsLoading && error && projects.length === 0 ? (
          <div className="rounded-2xl border border-red-300/20 bg-red-300/5 px-6 py-14 text-center">
            <FileJson aria-hidden="true" className="mx-auto h-10 w-10 text-red-200" />
            <h2 className="mt-4 text-lg font-semibold text-white">项目读取失败</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-400">{error}</p>
            <button
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/12 px-4 py-2.5 text-sm font-semibold text-white hover:border-cyan-100/40"
              onClick={() => void loadProjects()}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              重新加载
            </button>
          </div>
        ) : null}

        {!projectsLoading && !error && projects.length === 0 ? (
          <div className="overflow-hidden rounded-3xl border border-dashed border-cyan-100/20 bg-gradient-to-br from-cyan-200/[0.07] to-white/[0.02] px-5 py-12 text-center sm:px-10">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-200/10 text-cyan-100 shadow-[0_0_35px_rgba(78,229,218,0.12)]">
              <Sparkles aria-hidden="true" className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold text-white">开始你的第一个漫剧项目</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-stone-400">
              从创意到镜头，把故事、角色和分镜集中在一个项目中持续推进。
            </p>
            <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { icon: FileText, label: "AI 剧本创作" },
                { icon: Sparkles, label: "智能角色分析" },
                { icon: Clapperboard, label: "自动分镜生成" }
              ].map((feature) => (
                <div
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-black/20 px-4 py-4 text-sm text-stone-200"
                  key={feature.label}
                >
                  <feature.icon aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  {feature.label}
                </div>
              ))}
            </div>
            <button
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-[#61eadc] px-5 text-sm font-semibold text-[#04110f] transition hover:bg-cyan-100"
              onClick={openCreateModal}
              type="button"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              新建项目
            </button>
          </div>
        ) : null}

        {!projectsLoading && visibleProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {visibleProjects.map((project, index) => {
              const absoluteIndex = (currentPage - 1) * PAGE_SIZE + index;
              const projectKey = project.id ?? `${project.name}-${absoluteIndex}`;
              const menuOpen = activeMenuProjectId === projectKey;

              return (
                <div className="relative" key={projectKey}>
                  <button
                    aria-expanded={menuOpen}
                    aria-label={`${project.name} 项目操作`}
                    className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-black/65 text-stone-100 backdrop-blur-md transition hover:border-cyan-100/40 hover:bg-black/85"
                    onClick={() => setActiveMenuProjectId(menuOpen ? "" : projectKey)}
                    type="button"
                  >
                    <MoreVertical aria-hidden="true" className="h-4 w-4" />
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-3 top-14 z-30 w-40 overflow-hidden rounded-xl border border-white/12 bg-[#0a1019]/98 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
                      <button
                        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-stone-100 transition hover:bg-white/8"
                        onClick={() => openEditModal(project)}
                        type="button"
                      >
                        <Edit3 aria-hidden="true" className="h-4 w-4" />
                        编辑
                      </button>
                      <button
                        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-stone-100 transition hover:bg-white/8"
                        onClick={() => openExportModal(project)}
                        type="button"
                      >
                        <Download aria-hidden="true" className="h-4 w-4" />
                        导出
                      </button>
                      <button
                        className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-red-200 transition hover:bg-red-300/10"
                        onClick={() => {
                          setActiveMenuProjectId("");
                          setDeleteTarget(project);
                        }}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        删除
                      </button>
                    </div>
                  ) : null}

                  <ProjectCard
                    cover={projectCover(absoluteIndex, project)}
                    onOpen={() => openProject(project)}
                    project={project}
                    ratio={projectRatio(project, absoluteIndex)}
                  />
                </div>
              );
            })}
          </div>
        ) : null}

        {!projectsLoading && projects.length > PAGE_SIZE ? (
          <nav
            aria-label="项目分页"
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            <button
              aria-label="上一页"
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:border-cyan-100/35 disabled:cursor-not-allowed disabled:opacity-35"
              disabled={currentPage === 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNumber = index + 1;

              return (
                <button
                  aria-current={currentPage === pageNumber ? "page" : undefined}
                  className={cn(
                    "h-9 min-w-9 rounded-lg border px-3 text-sm transition",
                    currentPage === pageNumber
                      ? "border-cyan-100/50 bg-cyan-100 text-zinc-950"
                      : "border-white/10 text-stone-300 hover:border-cyan-100/35"
                  )}
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              aria-label="下一页"
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:border-cyan-100/35 disabled:cursor-not-allowed disabled:opacity-35"
              disabled={currentPage === totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </nav>
        ) : null}

        <div className="mt-16 border-t border-white/8 pt-10">
          <div className="mb-7 flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/8 bg-white/[0.045] text-cyan-100">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-white">项目示例</h2>
              <p className="mt-1 text-sm text-stone-500">选择案例复刻为自己的项目</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {exampleProjects.map((example) => (
              <ExampleCard
                example={example}
                key={example.name}
                onCopy={() => void copyExample(example)}
                saving={copyingName === example.name}
              />
            ))}
          </div>
        </div>
      </div>

      {createOpen ? (
        <div
          aria-labelledby="project-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/78 px-4 py-8 backdrop-blur-lg"
          role="dialog"
        >
          <form
            className="mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl border border-white/12 bg-[#0b1018] shadow-[0_28px_100px_rgba(0,0,0,0.65)]"
            onSubmit={submit}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                  Project
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white" id="project-modal-title">
                  {editingProject ? "编辑项目" : "新建项目"}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  完善基础信息后即可进入项目继续创作
                </p>
              </div>
              <button
                aria-label="关闭项目弹窗"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:bg-white/8"
                onClick={closeProjectModal}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-7">
              {formError ? (
                <div className="rounded-xl border border-red-300/20 bg-red-300/8 px-4 py-3 text-sm text-red-100">
                  {formError}
                </div>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-stone-200">
                  项目名称 <span className="text-red-300">*</span>
                </span>
                <input
                  autoFocus
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10"
                  maxLength={255}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (formError === "请填写项目名称。 ") {
                      setFormError("");
                    }
                  }}
                  placeholder="请输入项目名称"
                  required
                  value={name}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-stone-200">项目描述</span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10"
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="简要描述故事设定、受众与创作方向"
                  value={source}
                />
              </label>

              <div>
                <p className="text-sm font-medium text-stone-200">画面比例</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {aspectRatioOptions.map((option) => {
                    const selected = aspectRatio === option.value;

                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left transition",
                          selected
                            ? "border-cyan-200/70 bg-cyan-200/12 text-cyan-50"
                            : "border-white/10 bg-white/[0.025] text-stone-400 hover:border-white/25 hover:text-white"
                        )}
                        key={option.value}
                        onClick={() => setAspectRatio(option.value)}
                        type="button"
                      >
                        <span className="block text-sm font-semibold">{option.value}</span>
                        <span className="mt-1 block text-xs opacity-70">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-stone-200">
                  <Palette aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                  全局风格
                </span>
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60 focus:ring-2 focus:ring-cyan-200/10"
                  onChange={(event) => setStyle(event.target.value)}
                  placeholder="例如：3D国创、电影级灯光、真实材质、冷暖对比"
                  value={style}
                />
              </label>

              {editingProject ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-stone-200">项目封面</p>
                    <span className="text-xs text-stone-500">支持 JPG、PNG、WEBP，最大 10MB</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr] sm:items-center">
                    <div
                      className={cn(
                        "relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-cover bg-center",
                        !coverImage &&
                          !projectCover(0, editingProject) &&
                          "bg-[linear-gradient(135deg,#18212b_0%,#0c131b_52%,#17242a_100%)]"
                      )}
                      style={
                        coverImage || projectCover(0, editingProject)
                          ? {
                              backgroundImage: `url('${coverImage || projectCover(0, editingProject)}')`
                            }
                          : undefined
                      }
                    >
                      {!coverImage && !projectCover(0, editingProject) ? (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-stone-500">
                          <Film aria-hidden="true" className="h-5 w-5" />
                          <span className="text-[11px]">暂无封面</span>
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/[0.035] px-4 text-sm font-semibold text-stone-100 transition hover:border-cyan-100/40 disabled:opacity-50">
                        {coverUploading ? (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud aria-hidden="true" className="h-4 w-4" />
                        )}
                        {coverUploading ? "正在上传" : "上传新封面"}
                        <input
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                          disabled={coverUploading}
                          onChange={(event) => void uploadProjectCover(event.target.files)}
                          type="file"
                        />
                      </label>
                      {coverUploadMessage ? (
                        <p className="mt-2 text-xs text-emerald-200">{coverUploadMessage}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/8 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                className="h-10 rounded-xl border border-white/12 px-5 text-sm font-semibold text-stone-200 transition hover:bg-white/8"
                disabled={saving || coverUploading}
                onClick={closeProjectModal}
                type="button"
              >
                取消
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#61eadc] px-5 text-sm font-semibold text-[#04110f] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || coverUploading}
                type="submit"
              >
                {saving ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                )}
                {saving
                  ? editingProject
                    ? "正在保存"
                    : "正在创建"
                  : editingProject
                    ? "保存修改"
                    : "创建并进入项目"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {exportTarget ? (
        <div
          aria-labelledby="export-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-[110] overflow-y-auto bg-black/78 px-4 py-8 backdrop-blur-lg"
          role="dialog"
        >
          <div className="mx-auto w-full max-w-[680px] overflow-hidden rounded-2xl border border-white/12 bg-[#0b1018] shadow-[0_28px_100px_rgba(0,0,0,0.65)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                  Export
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white" id="export-modal-title">
                  导出项目数据
                </h2>
                <p className="mt-1 line-clamp-1 text-sm text-stone-500">{exportTarget.name}</p>
              </div>
              <button
                aria-label="关闭导出弹窗"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-stone-300 transition hover:bg-white/8 disabled:opacity-40"
                disabled={exportStatus === "running"}
                onClick={closeExportModal}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-7">
              <div>
                <h3 className="text-sm font-semibold text-stone-100">选择导出章节</h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  项目资料为必选项，其余内容会从当前项目接口实时读取。
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {exportSections.map((section) => {
                    const checked = exportSelection.includes(section.key);
                    const locked = section.key === "project";

                    return (
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition",
                          checked
                            ? "border-cyan-200/30 bg-cyan-200/[0.07]"
                            : "border-white/8 bg-white/[0.02] hover:border-white/20",
                          locked && "cursor-default"
                        )}
                        key={section.key}
                      >
                        <input
                          checked={checked}
                          className="mt-1 h-4 w-4 accent-cyan-300"
                          disabled={locked || exportStatus === "running"}
                          onChange={() => toggleExportSection(section.key)}
                          type="checkbox"
                        />
                        <span>
                          <span className="block text-sm font-medium text-stone-100">
                            {section.label}
                            {locked ? (
                              <span className="ml-2 text-[11px] font-normal text-cyan-200">必选</span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-stone-500">
                            {section.summary}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {exportStatus !== "idle" ? (
                <div className="rounded-xl border border-white/8 bg-black/25 p-4">
                  <div className="flex items-center justify-between text-xs text-stone-400">
                    <span>
                      {exportStatus === "running"
                        ? "正在生成"
                        : exportStatus === "ready"
                          ? "生成完成"
                          : "生成失败"}
                    </span>
                    <span>{exportProgress}%</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        exportStatus === "error" ? "bg-red-300" : "bg-[#61eadc]"
                      )}
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                  <div
                    aria-live="polite"
                    className="mt-4 max-h-36 space-y-1 overflow-y-auto rounded-lg bg-black/35 px-3 py-2 font-mono text-[11px] leading-5 text-stone-400"
                  >
                    {exportLogs.map((log, index) => (
                      <p key={`${log}-${index}`}>{log}</p>
                    ))}
                  </div>
                  {exportError ? (
                    <p className="mt-3 text-sm text-red-200">{exportError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/8 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                className="h-10 rounded-xl border border-white/12 px-5 text-sm font-semibold text-stone-200 transition hover:bg-white/8 disabled:opacity-40"
                disabled={exportStatus === "running"}
                onClick={closeExportModal}
                type="button"
              >
                关闭
              </button>
              {exportStatus === "ready" && exportUrl ? (
                <a
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#61eadc] px-5 text-sm font-semibold text-[#04110f] transition hover:bg-cyan-100"
                  download={exportFileName}
                  href={exportUrl}
                >
                  <Download aria-hidden="true" className="h-4 w-4" />
                  下载 JSON
                </a>
              ) : (
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#61eadc] px-5 text-sm font-semibold text-[#04110f] transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={exportStatus === "running"}
                  onClick={() => void runProjectExport()}
                  type="button"
                >
                  {exportStatus === "running" ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileJson aria-hidden="true" className="h-4 w-4" />
                  )}
                  {exportStatus === "running" ? "正在读取数据" : "生成导出文件"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          aria-labelledby="delete-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/78 px-4 py-8 backdrop-blur-lg"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-300/20 bg-[#120d10] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.7)]">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-300/10 text-red-200">
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-white" id="delete-modal-title">
              永久删除项目？
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-400">
              「{deleteTarget.name}」及其关联数据将被永久删除，此操作不可撤销，也无法从回收站恢复。
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="h-10 rounded-xl border border-white/12 px-5 text-sm font-semibold text-stone-200 transition hover:bg-white/8"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                取消
              </button>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-300 px-5 text-sm font-semibold text-red-950 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deleting}
                onClick={() => void deleteExistingProject()}
                type="button"
              >
                {deleting ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                )}
                {deleting ? "正在删除" : "永久删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
