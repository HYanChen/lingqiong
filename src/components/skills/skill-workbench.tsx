"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Gauge,
  Layers3,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  UploadCloud
} from "lucide-react";

import type {
  SkillModelStatus,
  SkillModule,
  SkillPackageEntry,
  SkillRun,
  SkillTool
} from "@/lib/skill-workbench";
import { cn } from "@/lib/utils";

type ApiSkillResponse = {
  modelStatus?: SkillModelStatus;
  skills: SkillTool[];
};

type SkillChatAttachment = {
  fileName: string;
  path: string;
  size: number;
  truncated: boolean;
};

type SkillChatSavedFile = {
  createdAt: string;
  fileName: string;
  fileSize: number;
  id: string;
  path: string;
  source: "generated" | "read" | "manual";
};

type SkillChatMessage = {
  attachments: SkillChatAttachment[];
  content: string;
  createdAt: string;
  error: string | null;
  files: SkillChatSavedFile[];
  id: string;
  model: string | null;
  role: "user" | "assistant" | "system";
  sessionId: string;
  status: "success" | "error";
};

type SkillChatSession = {
  id: string;
  moduleTitle: string | null;
  skillName: string;
  title: string;
  updatedAt: string;
};

type SkillChatWorkspace = {
  root: string;
  userRoot: string;
};

type SkillChatResponse = {
  message?: string;
  messages?: SkillChatMessage[];
  ok: boolean;
  selectedSessionId?: string;
  sessions?: SkillChatSession[];
  workspace?: SkillChatWorkspace;
};

type SkillWorkspaceEntry = {
  kind: "directory" | "file";
  name: string;
  path: string;
  size: number;
  updatedAt: string;
};

type SkillFilesResponse = {
  currentDir?: string;
  entries?: SkillWorkspaceEntry[];
  file?: {
    content: string;
    fileName: string;
    path: string;
    size: number;
    truncated: boolean;
  };
  message?: string;
  ok: boolean;
  workspace?: SkillChatWorkspace;
};

type ProjectForm = {
  duration: string;
  focus: string;
  frame: string;
  platform: string;
  projectName: string;
  sourcePath: string;
};

type RunOptions = {
  executionDepth: string;
  outputFormat: string;
};

const frames = ["9:16 竖屏", "16:9 横屏", "21:9 故事版", "1:1 方屏", "不限"];
const platforms = ["通用", "抖音", "快手", "红果", "视频号", "小红书", "B站", "商务交付"];
const executionDepths = ["完整执行", "快速草案", "诊断优先", "交付版"];
const outputFormats = ["结构化正文", "表格清单", "提示词包", "交接文档"];

const emptyProject: ProjectForm = {
  duration: "3",
  focus: "保持项目可继续进入资产、分镜、视频生成，不编造真实数据。",
  frame: "9:16 竖屏",
  platform: "通用",
  projectName: "战纪宇宙 Skill 项目",
  sourcePath: ""
};

const emptyStatus: SkillModelStatus = {
  baseUrl: null,
  configured: false,
  hasToken: false,
  message: "正在检查灵穹 API",
  model: null,
  name: null
};

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
    "mt-2 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15";

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
          value={value}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-400">{label}</span>
      <select
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
        onChange={(event) => onChange(event.target.value)}
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

function StatusCard({ status }: { status: SkillModelStatus }) {
  const ready = status.configured && status.hasToken;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        ready ? "border-emerald-300/25 bg-emerald-300/10" : "border-amber-300/25 bg-amber-300/10"
      )}
    >
      <div className="flex items-center gap-3">
        {ready ? (
          <BadgeCheck aria-hidden="true" className="h-5 w-5 text-emerald-100" />
        ) : (
          <AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-100" />
        )}
        <div>
          <p className="text-sm font-semibold text-stone-50">{status.message}</p>
          <p className="mt-1 text-xs text-stone-400">
            {status.model ? `${status.name ?? "灵穹 API"} / ${status.model}` : "后台启用后即可运行"}
          </p>
        </div>
      </div>
    </div>
  );
}

function skillFilesSeed(displayName: string): SkillPackageEntry[] {
  const now = new Date().toISOString();

  return [
    {
      content: `# ${displayName || "新 Skill"}\n\n描述这个 Skill 的触发条件、输入材料、输出结构和边界。`,
      id: "file-skill-md",
      path: "SKILL.md",
      type: "file",
      updatedAt: now
    },
    {
      content: "补充执行规则、示例、反例和验收标准。",
      id: "file-reference",
      path: "references/instructions.md",
      type: "file",
      updatedAt: now
    }
  ];
}

function buildGeneratedPrompt(
  skill: SkillTool | undefined,
  module: SkillModule | undefined,
  project: ProjectForm,
  runOptions: RunOptions
) {
  if (!skill || !module) {
    return "";
  }

  return [
    `使用 ${skill.triggerName} 运行「${module.order} ${module.title}」。`,
    `项目：${project.projectName || "未命名项目"}`,
    `平台：${project.platform}；画幅：${project.frame}；目标时长：${project.duration || "未填"} 分钟。`,
    `源文件/素材：${project.sourcePath || "未填写"}`,
    `执行深度：${runOptions.executionDepth}；输出格式：${runOptions.outputFormat}`,
    `重点约束：${project.focus || "无"}`,
    "",
    "【模块执行规则】",
    module.prompt,
    "",
    "【交付要求】",
    module.outputs.map((item) => `- ${item}`).join("\n") || "- 结构化结果",
    "",
    `下一步建议方向：${module.nextStep}`,
    "请直接输出可交付结果。材料不足时先给最小可执行版本，再列缺口。"
  ].join("\n");
}

function moduleTone(accent: SkillModule["accent"]) {
  switch (accent) {
    case "amber":
      return "border-amber-300/35 bg-amber-300/10 text-amber-100";
    case "blue":
      return "border-sky-300/35 bg-sky-300/10 text-sky-100";
    case "green":
      return "border-emerald-300/35 bg-emerald-300/10 text-emerald-100";
    case "violet":
      return "border-violet-300/35 bg-violet-300/10 text-violet-100";
    default:
      return "border-white/15 bg-white/5 text-stone-200";
  }
}

function friendlySkillError(message: string) {
  if (/Authentication Fails|api key.*invalid|invalid/i.test(message)) {
    return "灵穹 API 渠道密钥无效，请联系平台运营人员更新有效 Key 后再运行。";
  }

  if (/quota|insufficient_quota|exceeded/i.test(message)) {
    return "灵穹 API 上游额度不足，请联系平台运营人员补充渠道额度后再运行。";
  }

  if (/No available channel|available channel/i.test(message)) {
    return "灵穹 API 没有匹配当前模型的可用渠道。请在 API 网关为当前模型开启渠道。";
  }

  return message;
}

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatChatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  });
}

export function SkillWorkbench() {
  const [activeView, setActiveView] = useState<"flow" | "chat" | "run" | "upload">("flow");
  const [skills, setSkills] = useState<SkillTool[]>([]);
  const [modelStatus, setModelStatus] = useState<SkillModelStatus>(emptyStatus);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [chatSessionId, setChatSessionId] = useState("");
  const [chatSessions, setChatSessions] = useState<SkillChatSession[]>([]);
  const [chatMessages, setChatMessages] = useState<SkillChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatFilePaths, setChatFilePaths] = useState("");
  const [chatSaveAs, setChatSaveAs] = useState("outputs/skill-result.md");
  const [chatWorkspace, setChatWorkspace] = useState<SkillChatWorkspace | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [workspaceDir, setWorkspaceDir] = useState("");
  const [workspaceEntries, setWorkspaceEntries] = useState<SkillWorkspaceEntry[]>([]);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [workspaceFilePath, setWorkspaceFilePath] = useState("outputs/quick-note.md");
  const [workspaceFileContent, setWorkspaceFileContent] = useState("");
  const [workspaceNewFolder, setWorkspaceNewFolder] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [project, setProject] = useState<ProjectForm>(emptyProject);
  const [runOptions, setRunOptions] = useState<RunOptions>({
    executionDepth: "完整执行",
    outputFormat: "结构化正文"
  });
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [latestRun, setLatestRun] = useState<SkillRun | null>(null);
  const [uploadForm, setUploadForm] = useState({
    category: "平台 Skill",
    description: "",
    displayName: "",
    materials: "用户输入\n源文件或素材\n输出要求",
    nextStep: "继续进入战纪宇宙生产线。",
    outputs: "结构化结果\n风险提醒\n下一步建议",
    prompt: "",
    reference: "SKILL.md",
    taskTitle: "启动任务",
    triggerName: "",
    visibility: "private"
  });
  const [packageFiles, setPackageFiles] = useState<SkillPackageEntry[]>(skillFilesSeed("新 Skill"));

  async function loadSkills() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/_wcu-api/skills", { cache: "no-store" });
      const data = (await response.json()) as ApiSkillResponse;

      if (!response.ok) {
        throw new Error("Skill 列表读取失败。");
      }

      setSkills(data.skills ?? []);
      setModelStatus(data.modelStatus ?? emptyStatus);
      const firstSkill = data.skills?.[0];

      setSelectedSkillId((current) => current || firstSkill?.id || "");
      setSelectedModuleId((current) => current || firstSkill?.modules[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Skill 工作台加载失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSkills();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function loadChat(nextSkillId = selectedSkillId, nextSessionId = chatSessionId) {
    if (!nextSkillId) {
      setChatSessions([]);
      setChatMessages([]);
      return;
    }

    setChatLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ skillId: nextSkillId });

      if (nextSessionId) {
        params.set("sessionId", nextSessionId);
      }

      const response = await fetch(`/_wcu-api/skills/chat?${params.toString()}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as SkillChatResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "Skill 聊天读取失败。");
      }

      setChatSessions(data.sessions ?? []);
      setChatMessages(data.messages ?? []);
      setChatWorkspace(data.workspace ?? null);
      setChatSessionId(data.selectedSessionId ?? nextSessionId ?? "");
      void loadWorkspaceFiles(workspaceDir, workspaceQuery);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Skill 聊天读取失败。");
    } finally {
      setChatLoading(false);
    }
  }

  async function loadWorkspaceFiles(nextDir = workspaceDir, nextQuery = workspaceQuery) {
    setWorkspaceLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (nextDir) {
        params.set("dir", nextDir);
      }

      if (nextQuery) {
        params.set("q", nextQuery);
      }

      const response = await fetch(`/_wcu-api/skills/files?${params.toString()}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as SkillFilesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "工作区文件读取失败。");
      }

      setWorkspaceEntries(data.entries ?? []);
      setWorkspaceDir(data.currentDir ?? nextDir);
      setChatWorkspace(data.workspace ?? chatWorkspace);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "工作区文件读取失败。");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function openWorkspaceFile(filePath: string) {
    setWorkspaceLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ path: filePath });
      const response = await fetch(`/_wcu-api/skills/files?${params.toString()}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as SkillFilesResponse;

      if (!response.ok || !data.ok || !data.file) {
        throw new Error(data.message ?? "文件打开失败。");
      }

      setWorkspaceFilePath(data.file.path);
      setWorkspaceFileContent(data.file.content);
      setMessage(`已打开 ${data.file.path}`);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "文件打开失败。");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function saveWorkspaceFile() {
    if (!workspaceFilePath.trim()) {
      setError("请填写要保存的文件路径。");
      return;
    }

    setWorkspaceSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/skills/files", {
        body: JSON.stringify({
          content: workspaceFileContent,
          path: workspaceFilePath
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = (await response.json()) as SkillFilesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "文件保存失败。");
      }

      setMessage(`已保存 ${workspaceFilePath}`);
      await loadWorkspaceFiles(workspaceDir, workspaceQuery);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "文件保存失败。");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function createWorkspaceFolder() {
    const folderPath = workspaceNewFolder.trim();

    if (!folderPath) {
      setError("请填写要创建的文件夹路径。");
      return;
    }

    setWorkspaceSaving(true);
    setError("");

    try {
      const response = await fetch("/_wcu-api/skills/files", {
        body: JSON.stringify({
          operation: "mkdir",
          path: folderPath
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const data = (await response.json()) as SkillFilesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "文件夹创建失败。");
      }

      setMessage(`已创建 ${folderPath}`);
      setWorkspaceNewFolder("");
      await loadWorkspaceFiles(workspaceDir, workspaceQuery);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "文件夹创建失败。");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  function startNewWorkspaceFile() {
    const baseDir = workspaceDir || "outputs";
    const filePath = `${baseDir.replace(/\/+$/, "")}/untitled-${Date.now()}.md`;

    setWorkspaceFilePath(filePath);
    setWorkspaceFileContent("");
    setMessage(`已准备新文件：${filePath}`);
  }

  async function uploadWorkspaceFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setWorkspaceSaving(true);
    setError("");
    setMessage("");

    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);

        if (workspaceDir) {
          form.set("dir", workspaceDir);
        }

        const response = await fetch("/_wcu-api/skills/files", {
          body: form,
          method: "POST"
        });
        const data = (await response.json()) as SkillFilesResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.message ?? `${file.name} 上传失败。`);
        }
      }

      setMessage(`已上传 ${files.length} 个文件。`);
      await loadWorkspaceFiles(workspaceDir, workspaceQuery);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "文件上传失败。");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function deleteWorkspacePath(filePath: string) {
    if (!window.confirm(`确认删除 ${filePath}？`)) {
      return;
    }

    setWorkspaceSaving(true);
    setError("");
    setMessage("");

    try {
      const params = new URLSearchParams({ path: filePath });
      const response = await fetch(`/_wcu-api/skills/files?${params.toString()}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as SkillFilesResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? "文件删除失败。");
      }

      if (workspaceFilePath === filePath) {
        setWorkspaceFileContent("");
      }

      setMessage(`已删除 ${filePath}`);
      await loadWorkspaceFiles(workspaceDir, workspaceQuery);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "文件删除失败。");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  function insertWorkspacePath(filePath: string) {
    if (!filePath.trim()) {
      setError("请先选择或填写文件路径。");
      return;
    }

    const current = fromLines(chatFilePaths);
    const normalizedPath = filePath.trim();

    if (!current.includes(normalizedPath)) {
      setChatFilePaths([...current, normalizedPath].join("\n"));
    }

    setMessage(`已加入读取列表：${normalizedPath}`);
  }

  function parentWorkspaceDir() {
    if (!workspaceDir) {
      return "";
    }

    const parts = workspaceDir.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(skills.map((skill) => skill.category)))],
    [skills]
  );
  const filteredSkills = useMemo(
    () =>
      selectedCategory === "全部"
        ? skills
        : skills.filter((skill) => skill.category === selectedCategory),
    [selectedCategory, skills]
  );
  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? filteredSkills[0] ?? skills[0],
    [filteredSkills, selectedSkillId, skills]
  );
  const selectedModule = useMemo(
    () =>
      selectedSkill?.modules.find((module) => module.id === selectedModuleId) ??
      selectedSkill?.modules[0],
    [selectedModuleId, selectedSkill]
  );
  const generatedPrompt = useMemo(
    () => buildGeneratedPrompt(selectedSkill, selectedModule, project, runOptions),
    [project, runOptions, selectedModule, selectedSkill]
  );
  const totalModules = useMemo(
    () => skills.reduce((total, skill) => total + skill.modules.length, 0),
    [skills]
  );
  const attachedWorkspacePaths = useMemo(() => fromLines(chatFilePaths), [chatFilePaths]);

  async function copyPrompt() {
    if (!generatedPrompt) {
      return;
    }

    await navigator.clipboard.writeText(generatedPrompt);
    setMessage("启动语已复制。");
  }

  async function copyResult() {
    if (!latestRun?.outputText) {
      return;
    }

    await navigator.clipboard.writeText(latestRun.outputText);
    setMessage("运行结果已复制。");
  }

  async function runSelectedSkill() {
    if (!selectedSkill || !selectedModule) {
      setError("请先选择 Skill 和任务模块。");
      return;
    }

    setRunning(true);
    setError("");
    setMessage("");
    setLatestRun(null);

    try {
      const response = await fetch("/_wcu-api/skills/run", {
        body: JSON.stringify({
          generatedPrompt,
          moduleId: selectedModule.id,
          project,
          runOptions,
          skillId: selectedSkill.id,
          userInput
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Skill 运行失败。");
      }

      setLatestRun(result.run);
      setMessage("Skill 已通过灵穹 API 完成调用。");
      await loadSkills();
    } catch (runError) {
      setError(
        friendlySkillError(runError instanceof Error ? runError.message : "Skill 运行失败。")
      );
    } finally {
      setRunning(false);
    }
  }

  async function sendChatMessage() {
    if (!selectedSkill || !selectedModule) {
      setError("请先选择 Skill 和模块。");
      return;
    }

    if (!chatInput.trim() && !fromLines(chatFilePaths).length) {
      setError("请输入聊天内容，或填写要读取的工作区文件路径。");
      return;
    }

    setChatSending(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/skills/chat", {
        body: JSON.stringify({
          filePaths: fromLines(chatFilePaths),
          message: chatInput,
          moduleId: selectedModule.id,
          project,
          runOptions,
          saveAs: chatSaveAs.trim() || undefined,
          sessionId: chatSessionId || undefined,
          skillId: selectedSkill.id
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = (await response.json()) as SkillChatResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Skill 聊天失败。");
      }

      setChatMessages(result.messages ?? []);
      setChatSessionId(result.selectedSessionId ?? result.sessions?.[0]?.id ?? chatSessionId);
      setChatWorkspace(result.workspace ?? chatWorkspace);
      setChatInput("");
      setMessage("Skill 已通过聊天模式调用灵穹 API。");
      await loadChat(selectedSkill.id, result.selectedSessionId ?? chatSessionId);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Skill 聊天失败。");
      await loadChat(selectedSkill.id, chatSessionId);
    } finally {
      setChatSending(false);
    }
  }

  function startNewChatSession() {
    setChatSessionId("");
    setChatMessages([]);
    setChatInput("");
    setMessage("已新建空白聊天。");
  }

  async function selectChatSession(sessionId: string) {
    setChatSessionId(sessionId);
    await loadChat(selectedSkillId, sessionId);
  }

  function selectSkill(skill: SkillTool) {
    setSelectedSkillId(skill.id);
    setSelectedModuleId(skill.modules[0]?.id ?? "");
    setSelectedCategory(skill.category);
    setChatSessionId("");
    setChatMessages([]);
    setChatSaveAs(`outputs/${skill.triggerName || "skill"}-result.md`);
    setActiveView("chat");
    void loadChat(skill.id, "");
  }

  function addPackageFile() {
    const now = new Date().toISOString();

    setPackageFiles((items) => [
      ...items,
      {
        content: "",
        id: `file-${Date.now()}`,
        path: `references/file-${items.length + 1}.md`,
        type: "file",
        updatedAt: now
      }
    ]);
  }

  function updatePackageFile(id: string, patch: Partial<SkillPackageEntry>) {
    setPackageFiles((items) =>
      items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      )
    );
  }

  async function saveUploadedSkill() {
    if (!uploadForm.displayName.trim()) {
      setError("请填写 Skill 名称。");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/skills", {
        body: JSON.stringify({
          ...uploadForm,
          materials: fromLines(uploadForm.materials),
          outputs: fromLines(uploadForm.outputs),
          packageFiles,
          visibility: uploadForm.visibility === "public" ? "public" : "private"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Skill 保存失败。");
      }

      setMessage("Skill 已保存到战纪宇宙主项目数据库。");
      await loadSkills();
      setSelectedSkillId(result.skill.id);
      setSelectedCategory(result.skill.category);
      setChatSaveAs(`outputs/${result.skill.triggerName || "skill"}-result.md`);
      setActiveView("chat");
      void loadChat(result.skill.id, "");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Skill 保存失败。");
    }
  }

  return (
    <main className="min-h-screen bg-[#050506] text-stone-100">
      <section className="relative overflow-hidden border-b border-white/10 px-5 py-14 md:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(34,211,238,0.18),transparent_28rem),radial-gradient(circle_at_88%_16%,rgba(180,83,9,0.12),transparent_28rem)]" />
        <div className="cinema-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
                Lingqiong Skill Workbench
              </p>
              <h1 className="mt-5 text-5xl font-semibold leading-[1.04] text-stone-50 md:text-7xl">
                灵穹 Skill 工作台
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-9 text-stone-300">
                把制片总控、剧本、资产、分镜、提示词和知识沉淀拆成可运行节点，统一走灵穹 API。
              </p>
            </div>
            <div className="grid gap-4">
              <StatusCard status={modelStatus} />
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Skill", String(skills.length)],
                  ["模块", String(totalModules)],
                  ["接口", "/v1"]
                ].map(([label, value]) => (
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4" key={label}>
                    <p className="text-xs text-stone-500">{label}</p>
                    <p className="mt-2 truncate text-xl font-semibold text-stone-50">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["flow", "生产节点"],
              ["chat", "Skill 聊天"],
              ["run", "运行控制台"],
              ["upload", "上传 Skill"]
            ].map(([id, label]) => (
              <button
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-semibold transition",
                  activeView === id
                    ? "border-cyan-200 bg-cyan-200 text-zinc-950"
                    : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-cyan-200/50 hover:text-white"
                )}
                key={id}
                onClick={() => {
                  setActiveView(id as typeof activeView);
                  if (id === "chat") {
                    void loadChat(selectedSkillId, chatSessionId);
                  }
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-cyan-200/50 hover:text-white"
            onClick={() => void loadSkills()}
            type="button"
          >
            <Radio aria-hidden="true" className="h-4 w-4" />
            刷新状态
          </button>
        </div>

        {message ? (
          <p className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 flex items-start gap-2 rounded-lg border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm leading-6 text-red-100">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-10 flex items-center gap-3 text-sm text-stone-400">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            正在读取 Skill 工具...
          </div>
        ) : null}

        {!loading && activeView === "flow" ? (
          <div className="mt-8 grid gap-6 xl:grid-cols-[18rem_1fr]">
            <aside className="h-fit rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-3">
                <Layers3 aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                <h2 className="text-base font-semibold text-stone-50">分类</h2>
              </div>
              <div className="mt-4 grid gap-2">
                {categories.map((category) => (
                  <button
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                      selectedCategory === category
                        ? "border-cyan-200 bg-cyan-200/10 text-cyan-50"
                        : "border-white/10 bg-black/20 text-stone-300 hover:border-cyan-200/50"
                    )}
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    type="button"
                  >
                    <span>{category}</span>
                    <span className="text-xs text-stone-500">
                      {category === "全部"
                        ? skills.length
                        : skills.filter((skill) => skill.category === category).length}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredSkills.map((skill) => (
                <button
                  className={cn(
                    "group rounded-lg border bg-white/[0.035] p-5 text-left transition hover:border-cyan-200/50 hover:bg-white/[0.06]",
                    selectedSkill?.id === skill.id ? "border-cyan-200/60" : "border-white/10"
                  )}
                  key={skill.id}
                  onClick={() => selectSkill(skill)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
                      <Sparkles aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400">
                      {skill.category}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-stone-50">{skill.displayName}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-stone-400">
                    {skill.description}
                  </p>
                  <div className="mt-5 grid gap-2">
                    {skill.modules.slice(0, 3).map((module) => (
                      <span
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-stone-400"
                        key={module.id}
                      >
                        {module.order} {module.title}
                        <ArrowRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-stone-600 transition group-hover:text-cyan-100"
                        />
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!loading && activeView === "chat" ? (
          <div className="mt-8 grid gap-5 xl:grid-cols-[21rem_1fr]">
            <div className="space-y-5">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center gap-3">
                  <MessageSquare aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                  <h2 className="text-lg font-semibold text-stone-50">选择 Skill</h2>
                </div>
                <div className="mt-5 grid gap-3">
                  {skills.map((skill) => (
                    <button
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left text-sm transition",
                        selectedSkill?.id === skill.id
                          ? "border-cyan-200 bg-cyan-200/10 text-cyan-50"
                          : "border-white/10 bg-black/20 text-stone-300 hover:border-cyan-200/50"
                      )}
                      key={skill.id}
                      onClick={() => selectSkill(skill)}
                      type="button"
                    >
                      <span className="font-semibold">{skill.displayName}</span>
                      <span className="mt-1 block text-xs text-stone-500">
                        {skill.category} / {skill.modules.length} 个模块
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-stone-50">任务模块</h2>
                  <button
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                    onClick={startNewChatSession}
                    type="button"
                  >
                    新会话
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  {selectedSkill?.modules.map((module) => (
                    <button
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition",
                        selectedModule?.id === module.id
                          ? "border-cyan-200 bg-cyan-200/10"
                          : "border-white/10 bg-black/20 hover:border-cyan-200/50"
                      )}
                      key={module.id}
                      onClick={() => setSelectedModuleId(module.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-stone-50">
                          {module.order} {module.title}
                        </p>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", moduleTone(module.accent))}>
                          {module.status}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-6 text-stone-500">
                        {module.description}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FolderOpen aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                    <h2 className="text-lg font-semibold text-stone-50">文件工作区</h2>
                  </div>
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-stone-300 transition hover:border-cyan-200/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={workspaceLoading}
                    onClick={() => void loadWorkspaceFiles(workspaceDir, workspaceQuery)}
                    title="刷新文件"
                    type="button"
                  >
                    {workspaceLoading ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="mt-3 break-all rounded-lg border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-stone-500">
                  {chatWorkspace?.userRoot ?? "登录后自动分配 Skill 文件目录"}
                </p>

                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadWorkspaceFiles(workspaceDir, workspaceQuery);
                  }}
                >
                  <label className="relative flex-1">
                    <Search
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-600"
                    />
                    <input
                      className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60"
                      onChange={(event) => setWorkspaceQuery(event.target.value)}
                      placeholder="搜索文件"
                      value={workspaceQuery}
                    />
                  </label>
                  <button
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                    type="submit"
                  >
                    搜索
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                    disabled={!workspaceDir}
                    onClick={() => {
                      const parent = parentWorkspaceDir();
                      setWorkspaceDir(parent);
                      void loadWorkspaceFiles(parent, workspaceQuery);
                    }}
                    type="button"
                  >
                    返回上级
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                    onClick={startNewWorkspaceFile}
                    type="button"
                  >
                    <FilePlus2 aria-hidden="true" className="h-3.5 w-3.5" />
                    新文件
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white">
                    <UploadCloud aria-hidden="true" className="h-3.5 w-3.5" />
                    上传
                    <input
                      className="sr-only"
                      multiple
                      onChange={(event) => {
                        void uploadWorkspaceFiles(event.target.files);
                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/60"
                    onChange={(event) => setWorkspaceNewFolder(event.target.value)}
                    placeholder={workspaceDir ? `${workspaceDir}/资料` : "inputs 或 outputs/episode-01"}
                    value={workspaceNewFolder}
                  />
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={workspaceSaving}
                    onClick={() => void createWorkspaceFolder()}
                    type="button"
                  >
                    <FolderPlus aria-hidden="true" className="h-3.5 w-3.5" />
                    新建夹
                  </button>
                </div>

                <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-black/20">
                  <div className="border-b border-white/10 px-3 py-2 text-[11px] text-stone-500">
                    当前目录：{workspaceDir || "/"}
                  </div>
                  {workspaceEntries.length ? (
                    <div className="divide-y divide-white/10">
                      {workspaceEntries.map((entry) => (
                        <div className="flex items-center gap-2 px-3 py-2" key={entry.path}>
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => {
                              if (entry.kind === "directory") {
                                setWorkspaceDir(entry.path);
                                void loadWorkspaceFiles(entry.path, workspaceQuery);
                              } else {
                                void openWorkspaceFile(entry.path);
                              }
                            }}
                            type="button"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-stone-100">
                              {entry.kind === "directory" ? (
                                <FolderOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-cyan-100" />
                              ) : (
                                <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-stone-400" />
                              )}
                              <span className="truncate">{entry.name}</span>
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-stone-600">
                              {entry.path}
                              {entry.kind === "file" ? ` / ${formatBytes(entry.size)}` : ""}
                            </span>
                          </button>
                          {entry.kind === "file" ? (
                            <button
                              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                              onClick={() => insertWorkspacePath(entry.path)}
                              type="button"
                            >
                              读取
                            </button>
                          ) : null}
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-stone-500 transition hover:border-red-300/40 hover:text-red-100"
                            onClick={() => void deleteWorkspacePath(entry.path)}
                            title="删除"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-8 text-center text-sm text-stone-500">
                      {workspaceLoading ? "正在读取文件..." : "当前目录暂无文件。"}
                    </p>
                  )}
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <label className="block">
                    <span className="text-xs font-medium text-stone-400">编辑/保存路径</span>
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
                      onChange={(event) => setWorkspaceFilePath(event.target.value)}
                      placeholder="outputs/result.md"
                      value={workspaceFilePath}
                    />
                  </label>
                  <textarea
                    className="mt-3 min-h-40 w-full resize-y rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
                    onChange={(event) => setWorkspaceFileContent(event.target.value)}
                    placeholder="在这里编辑文件内容，保存后可作为聊天上下文继续调用灵穹 API。"
                    value={workspaceFileContent}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={workspaceSaving}
                      onClick={() => void saveWorkspaceFile()}
                      type="button"
                    >
                      {workspaceSaving ? (
                        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      保存文件
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                      onClick={() => insertWorkspacePath(workspaceFilePath)}
                      type="button"
                    >
                      <Clipboard aria-hidden="true" className="h-3.5 w-3.5" />
                      加入上下文
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold text-stone-50">历史会话</h2>
                <div className="mt-4 grid gap-2">
                  {chatSessions.length ? (
                    chatSessions.map((item) => (
                      <button
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left transition",
                          chatSessionId === item.id
                            ? "border-cyan-200 bg-cyan-200/10"
                            : "border-white/10 bg-black/20 hover:border-cyan-200/50"
                        )}
                        key={item.id}
                        onClick={() => void selectChatSession(item.id)}
                        type="button"
                      >
                        <span className="line-clamp-1 text-sm font-semibold text-stone-100">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs text-stone-500">
                          {item.moduleTitle ?? item.skillName} / {formatChatTime(item.updatedAt)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-stone-500">
                      暂无会话，发送第一条消息后会自动创建。
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                      Skill Chat
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-50">
                      {selectedSkill?.displayName ?? "请选择 Skill"}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-stone-400">
                      {selectedModule
                        ? `${selectedModule.order} ${selectedModule.title}：${selectedModule.description}`
                        : "选择一个模块后即可聊天执行。"}
                    </p>
                  </div>
                  <StatusCard status={modelStatus} />
                </div>
                {selectedModule ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                      <p className="text-xs font-semibold text-stone-300">所需材料</p>
                      <ul className="mt-3 space-y-2 text-sm text-stone-500">
                        {selectedModule.materials.map((item) => (
                          <li className="flex gap-2" key={item}>
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-200" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                      <p className="text-xs font-semibold text-stone-300">交付物</p>
                      <ul className="mt-3 space-y-2 text-sm text-stone-500">
                        {selectedModule.outputs.map((item) => (
                          <li className="flex gap-2" key={item}>
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-200" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="min-h-[28rem] rounded-lg border border-white/10 bg-zinc-950/70 p-4">
                {chatLoading ? (
                  <div className="flex items-center gap-3 p-4 text-sm text-stone-400">
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    正在读取聊天记录...
                  </div>
                ) : null}
                <div className="space-y-4">
                  {!chatMessages.length && !chatLoading ? (
                    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6">
                      <p className="text-lg font-semibold text-stone-50">开始和这个 Skill 聊天</p>
                      <p className="mt-3 text-sm leading-7 text-stone-400">
                        你可以直接描述任务，也可以先把文件放进工作区，再在下方填写相对路径让 Skill 读取。
                      </p>
                    </div>
                  ) : null}
                  {chatMessages.map((item) => (
                    <article
                      className={cn(
                        "rounded-lg border p-4",
                        item.role === "user"
                          ? "ml-auto border-cyan-200/25 bg-cyan-200/10"
                          : item.status === "error"
                            ? "border-red-300/25 bg-red-300/10"
                            : "border-white/10 bg-white/[0.045]"
                      )}
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                          {item.role === "user" ? "You" : "Lingqiong API"}
                        </p>
                        <p className="text-xs text-stone-600">
                          {item.model ? `${item.model} / ` : ""}
                          {formatChatTime(item.createdAt)}
                        </p>
                      </div>
                      <pre className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-200">
                        {item.content}
                      </pre>
                      {item.attachments.length ? (
                        <div className="mt-3 grid gap-2">
                          {item.attachments.map((file) => (
                            <span
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-stone-400"
                              key={file.path}
                            >
                              <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                              {file.path} / {formatBytes(file.size)}
                              {file.truncated ? " / 已截断" : ""}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {item.files.length ? (
                        <div className="mt-3 grid gap-2">
                          {item.files.map((file) => (
                            <span
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100"
                              key={file.id}
                            >
                              <Save aria-hidden="true" className="h-3.5 w-3.5" />
                              已保存：{file.path} / {formatBytes(file.fileSize)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                    onClick={() => insertWorkspacePath(workspaceFilePath)}
                    type="button"
                  >
                    <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                    读取当前文件
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                    onClick={() => {
                      setChatSaveAs(workspaceFilePath);
                      setMessage(`本轮结果将保存到：${workspaceFilePath}`);
                    }}
                    type="button"
                  >
                    <Save aria-hidden="true" className="h-3.5 w-3.5" />
                    保存到当前路径
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-cyan-200/50 hover:text-white"
                    onClick={() =>
                      setChatInput((current) =>
                        [
                          current.trim(),
                          "请按多个可保存文件输出，每个文件使用 <<<SAVE_FILE:outputs/文件名.md>>> 到 <<<END_SAVE_FILE>>> 包裹。"
                        ]
                          .filter(Boolean)
                          .join("\n\n")
                      )
                    }
                    type="button"
                  >
                    <FilePlus2 aria-hidden="true" className="h-3.5 w-3.5" />
                    多文件输出
                  </button>
                </div>
                {attachedWorkspacePaths.length ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {attachedWorkspacePaths.map((filePath) => (
                      <span
                        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-50"
                        key={filePath}
                      >
                        <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{filePath}</span>
                        <button
                          className="text-stone-400 transition hover:text-white"
                          onClick={() =>
                            setChatFilePaths(
                              attachedWorkspacePaths.filter((item) => item !== filePath).join("\n")
                            )
                          }
                          title="移除上下文文件"
                          type="button"
                        >
                          移除
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="项目名称"
                    onChange={(value) => setProject((current) => ({ ...current, projectName: value }))}
                    value={project.projectName}
                  />
                  <SelectField
                    label="输出格式"
                    onChange={(value) => setRunOptions((current) => ({ ...current, outputFormat: value }))}
                    options={outputFormats}
                    value={runOptions.outputFormat}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="读取工作区文件，每行一个相对路径"
                      multiline
                      onChange={setChatFilePaths}
                      placeholder="例如：inputs/剧本.txt"
                      value={chatFilePaths}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="本轮结果自动保存到"
                      onChange={setChatSaveAs}
                      placeholder="outputs/result.md，留空则只在聊天里显示"
                      value={chatSaveAs}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="聊天内容"
                      multiline
                      onChange={setChatInput}
                      placeholder="直接告诉 Skill 你要完成什么；需要保存多个文件时，也可以要求它用 SAVE_FILE 块输出。"
                      value={chatInput}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-6 text-stone-500">
                    文件保存后会落在上方工作区目录，对应主机项目的 data/skill-workspace。
                  </p>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={chatSending}
                    onClick={() => void sendChatMessage()}
                    type="button"
                  >
                    {chatSending ? (
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send aria-hidden="true" className="h-4 w-4" />
                    )}
                    {chatSending ? "发送中" : "发送给 Skill"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {!loading && activeView === "run" ? (
          <div className="mt-8 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
            <div className="space-y-5">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center gap-3">
                  <BookOpen aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                  <h2 className="text-lg font-semibold text-stone-50">Skill</h2>
                </div>
                <div className="mt-5 grid gap-3">
                  {skills.map((skill) => (
                    <button
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left text-sm transition",
                        selectedSkill?.id === skill.id
                          ? "border-cyan-200 bg-cyan-200/10 text-cyan-50"
                          : "border-white/10 bg-black/20 text-stone-300 hover:border-cyan-200/50"
                      )}
                      key={skill.id}
                      onClick={() => selectSkill(skill)}
                      type="button"
                    >
                      <span className="font-semibold">{skill.displayName}</span>
                      <span className="mt-1 block text-xs text-stone-500">{skill.triggerName}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <h2 className="text-lg font-semibold text-stone-50">模块</h2>
                <div className="mt-4 grid gap-3">
                  {selectedSkill?.modules.map((module) => (
                    <button
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition",
                        selectedModule?.id === module.id
                          ? "border-cyan-200 bg-cyan-200/10"
                          : "border-white/10 bg-black/20 hover:border-cyan-200/50"
                      )}
                      key={module.id}
                      onClick={() => setSelectedModuleId(module.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-stone-50">
                          {module.order} {module.title}
                        </p>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", moduleTone(module.accent))}>
                          {module.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-stone-500">{module.description}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                      Run Console
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-50">
                      {selectedSkill?.displayName ?? "请选择 Skill"}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-stone-400">
                      {selectedModule?.description ?? "选择一个模块后即可运行。"}
                    </p>
                  </div>
                  <StatusCard status={modelStatus} />
                </div>

                {selectedModule ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                      <p className="text-xs font-semibold text-stone-300">所需材料</p>
                      <ul className="mt-3 space-y-2 text-sm text-stone-500">
                        {selectedModule.materials.map((item) => (
                          <li className="flex gap-2" key={item}>
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-200" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                      <p className="text-xs font-semibold text-stone-300">交付物</p>
                      <ul className="mt-3 space-y-2 text-sm text-stone-500">
                        {selectedModule.outputs.map((item) => (
                          <li className="flex gap-2" key={item}>
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-200" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center gap-3">
                  <Gauge aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                  <h2 className="text-lg font-semibold text-stone-50">运行参数</h2>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field
                    label="项目名称"
                    onChange={(value) => setProject((current) => ({ ...current, projectName: value }))}
                    value={project.projectName}
                  />
                  <SelectField
                    label="平台"
                    onChange={(value) => setProject((current) => ({ ...current, platform: value }))}
                    options={platforms}
                    value={project.platform}
                  />
                  <SelectField
                    label="画幅"
                    onChange={(value) => setProject((current) => ({ ...current, frame: value }))}
                    options={frames}
                    value={project.frame}
                  />
                  <Field
                    label="目标时长 / 分钟"
                    onChange={(value) => setProject((current) => ({ ...current, duration: value }))}
                    value={project.duration}
                  />
                  <SelectField
                    label="执行深度"
                    onChange={(value) =>
                      setRunOptions((current) => ({ ...current, executionDepth: value }))
                    }
                    options={executionDepths}
                    value={runOptions.executionDepth}
                  />
                  <SelectField
                    label="输出格式"
                    onChange={(value) => setRunOptions((current) => ({ ...current, outputFormat: value }))}
                    options={outputFormats}
                    value={runOptions.outputFormat}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="源文件或素材路径"
                      onChange={(value) => setProject((current) => ({ ...current, sourcePath: value }))}
                      placeholder="/Users/..."
                      value={project.sourcePath}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="重点约束"
                      multiline
                      onChange={(value) => setProject((current) => ({ ...current, focus: value }))}
                      value={project.focus}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label="补充输入"
                      multiline
                      onChange={setUserInput}
                      placeholder="粘贴剧本、任务说明、材料摘要或你希望 Skill 处理的问题。"
                      value={userInput}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Clipboard aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                    <h2 className="text-lg font-semibold text-stone-50">启动语</h2>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                    onClick={copyPrompt}
                    type="button"
                  >
                    <Copy aria-hidden="true" className="h-4 w-4" />
                    复制
                  </button>
                </div>
                <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/45 p-4 text-sm leading-7 text-stone-300">
                  {generatedPrompt || "请选择 Skill。"}
                </pre>
                <button
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={running}
                  onClick={runSelectedSkill}
                  type="button"
                >
                  {running ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play aria-hidden="true" className="h-4 w-4" />
                  )}
                  {running ? "调用中" : "调用灵穹 API 运行"}
                </button>
              </section>

              {latestRun ? (
                <section className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                        Run Result
                      </p>
                      <h2 className="mt-3 text-lg font-semibold text-stone-50">
                        {latestRun.skillName} / {latestRun.moduleTitle}
                      </h2>
                    </div>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                      onClick={copyResult}
                      type="button"
                    >
                      <Copy aria-hidden="true" className="h-4 w-4" />
                      复制结果
                    </button>
                  </div>
                  <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/45 p-4 text-sm leading-7 text-stone-200">
                    {latestRun.outputText}
                  </pre>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}

        {!loading && activeView === "upload" ? (
          <div className="mt-8 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center gap-3">
                <UploadCloud aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                <h2 className="text-lg font-semibold text-stone-50">上传 / 新建 Skill</h2>
              </div>
              <div className="mt-5 grid gap-4">
                <Field
                  label="Skill 显示名称"
                  onChange={(value) => {
                    setUploadForm((current) => ({
                      ...current,
                      displayName: value,
                      triggerName:
                        current.triggerName ||
                        value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                    }));
                    setPackageFiles((current) =>
                      current.map((file) =>
                        file.path === "SKILL.md"
                          ? {
                              ...file,
                              content: `# ${value || "新 Skill"}\n\n描述这个 Skill 的触发条件、输入材料、输出结构和边界。`
                            }
                          : file
                      )
                    );
                  }}
                  placeholder="例如：品牌短片脚本助手"
                  value={uploadForm.displayName}
                />
                <Field
                  label="触发名"
                  onChange={(value) => setUploadForm((current) => ({ ...current, triggerName: value }))}
                  placeholder="brand-film-script"
                  value={uploadForm.triggerName}
                />
                <Field
                  label="分类"
                  onChange={(value) => setUploadForm((current) => ({ ...current, category: value }))}
                  value={uploadForm.category}
                />
                <Field
                  label="用途说明"
                  multiline
                  onChange={(value) => setUploadForm((current) => ({ ...current, description: value }))}
                  placeholder="写给用户看的用途说明。"
                  value={uploadForm.description}
                />
                <Field
                  label="默认任务"
                  onChange={(value) => setUploadForm((current) => ({ ...current, taskTitle: value }))}
                  value={uploadForm.taskTitle}
                />
                <Field
                  label="默认启动规则"
                  multiline
                  onChange={(value) => setUploadForm((current) => ({ ...current, prompt: value }))}
                  placeholder="写清楚这个 Skill 应该如何执行、输出什么、有什么边界。"
                  value={uploadForm.prompt}
                />
                <Field
                  label="所需材料，每行一个"
                  multiline
                  onChange={(value) => setUploadForm((current) => ({ ...current, materials: value }))}
                  value={uploadForm.materials}
                />
                <Field
                  label="产出项，每行一个"
                  multiline
                  onChange={(value) => setUploadForm((current) => ({ ...current, outputs: value }))}
                  value={uploadForm.outputs}
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                  onClick={saveUploadedSkill}
                  type="button"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  保存 Skill
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-stone-50">Skill 文件包</h2>
                  <p className="mt-2 text-sm text-stone-500">
                    保存后会写入主项目数据库，后台也能继续编辑。
                  </p>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                  onClick={addPackageFile}
                  type="button"
                >
                  <FilePlus2 aria-hidden="true" className="h-4 w-4" />
                  新建文件
                </button>
              </div>
              <div className="mt-5 grid gap-4">
                {packageFiles.map((file) => (
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4" key={file.id}>
                    <Field
                      label="路径"
                      onChange={(value) => updatePackageFile(file.id, { path: value })}
                      value={file.path}
                    />
                    <div className="mt-3">
                      <Field
                        label="内容"
                        multiline
                        onChange={(value) => updatePackageFile(file.id, { content: value })}
                        value={file.content}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
