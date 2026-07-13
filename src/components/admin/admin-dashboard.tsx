"use client";

import { useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clapperboard,
  Database as DatabaseIcon,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  PlugZap,
  QrCode,
  Save,
  Trash2,
  Upload,
  UsersRound,
  WandSparkles,
  XCircle
} from "lucide-react";

import type {
  IconKey,
  PipelineStep,
  Service,
  SiteData,
  TeamMember,
  UniverseChapter,
  Work
} from "@/content/site";
import { ModelApiAdmin } from "@/components/admin/model-api-admin";
import { NewApiConsole } from "@/components/admin/new-api-console";
import { AdminSecurityAdmin } from "@/components/admin/admin-security-admin";
import { AdminLogin } from "@/components/admin/admin-login";
import { SkillAdmin } from "@/components/admin/skill-admin";
import { defaultSiteData } from "@/content/site";
import type { AdminPermission, AdminRole } from "@/lib/admin-permissions";
import type { ProjectType } from "@/lib/project-types";
import { cn } from "@/lib/utils";

type AdminTab =
  | "api"
  | "audit"
  | "brand"
  | "database"
  | "knowledge"
  | "login"
  | "overview"
  | "services"
  | "skills"
  | "types"
  | "universe"
  | "users"
  | "workflow"
  | "works";

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: "overview", label: "平台总览" },
  { id: "brand", label: "官网内容" },
  { id: "works", label: "作品" },
  { id: "types", label: "类型分类" },
  { id: "skills", label: "Skill" },
  { id: "services", label: "服务" },
  { id: "universe", label: "世界观" },
  { id: "workflow", label: "生产线" },
  { id: "login", label: "登录设置" },
  { id: "knowledge", label: "知识库" },
  { id: "api", label: "API网关" },
  { id: "database", label: "数据库" },
  { id: "users", label: "管理员" },
  { id: "audit", label: "审计日志" }
];

const contentTabs: AdminTab[] = ["brand", "works", "services", "universe", "workflow"];
const defaultTeamGroups: TeamMember["group"][] = [
  "领军人物",
  "战略投资顾问",
  "核心团队"
];

type DatabaseStats = {
  counts: {
    frontUsers: number;
    inviteCodes: number;
    modelApiCalls: number;
    modelApis: number;
    projectTypes: number;
    projects: number;
    skillRuns: number;
    skillTools: number;
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

type CurrentAdmin = {
  id: string;
  permissions: AdminPermission[];
  role: AdminRole;
  username: string;
};

const tabPermissions: Partial<Record<AdminTab, AdminPermission>> = {
  api: "modelApi.read",
  audit: "audit.read",
  brand: "content.read",
  database: "database.read",
  login: "settings.read",
  services: "content.read",
  skills: "skills.read",
  types: "projects.read",
  universe: "content.read",
  users: "users.read",
  workflow: "content.read",
  works: "content.read"
};

type EditableProjectType = ProjectType & {
  draft?: boolean;
};

type OAuthProviderId = "apple" | "github" | "google";

type OAuthLoginSettings = {
  accountClaim: string;
  authorizeUrl: string;
  clientId: string;
  clientSecretConfigured: boolean;
  contactClaim: string;
  enabled: boolean;
  label: string;
  scopes: string;
  tokenUrl: string;
  userInfoUrl: string;
};

type LoginSettings = {
  oauth: Record<OAuthProviderId, OAuthLoginSettings>;
  wechat: {
    appId: string;
    appSecretConfigured: boolean;
    defaultAccount: string;
    defaultContact: string;
    enabled: boolean;
    mode: "local-scan" | "official";
    qrHint: string;
    qrTitle: string;
  };
};

const emptyLoginSettings: LoginSettings = {
  oauth: {
    apple: {
      accountClaim: "name|email|sub",
      authorizeUrl: "https://appleid.apple.com/auth/authorize",
      clientId: "",
      clientSecretConfigured: false,
      contactClaim: "email|sub",
      enabled: false,
      label: "Apple",
      scopes: "name email",
      tokenUrl: "https://appleid.apple.com/auth/token",
      userInfoUrl: ""
    },
    github: {
      accountClaim: "name|login",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      clientId: "",
      clientSecretConfigured: false,
      contactClaim: "email|login",
      enabled: false,
      label: "GitHub",
      scopes: "read:user user:email",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user"
    },
    google: {
      accountClaim: "name|email",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      clientId: "",
      clientSecretConfigured: false,
      contactClaim: "email|sub",
      enabled: false,
      label: "Google",
      scopes: "openid profile email",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo"
    }
  },
  wechat: {
    appId: "",
    appSecretConfigured: false,
    defaultAccount: "微信创作者",
    defaultContact: "wechat-user",
    enabled: true,
    mode: "local-scan",
    qrHint: "使用微信扫一扫，打开确认页后即可进入战纪宇宙统一平台。",
    qrTitle: "微信扫码登录"
  }
};

const oauthProviderIds: OAuthProviderId[] = ["google", "github", "apple"];

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

function nextTeamMemberSlug(members: TeamMember[]) {
  let suffix = members.length + 1;
  let slug = `new-member-${suffix}`;
  const used = new Set(members.map((member) => member.slug));

  while (used.has(slug)) {
    suffix += 1;
    slug = `new-member-${suffix}`;
  }

  return slug;
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
  const normalizedOptions = Array.from(
    new Set([value, ...options].map((item) => item.trim()).filter(Boolean))
  );

  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-400">{label}</span>
      <select
        className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const requestedTab = searchParams.get("tab");

    return tabs.some((tab) => tab.id === requestedTab)
      ? (requestedTab as AdminTab)
      : "overview";
  });
  const [authenticated, setAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [data, setData] = useState<SiteData | null>(null);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [loginSettings, setLoginSettings] = useState<LoginSettings>(emptyLoginSettings);
  const [oauthSecretDrafts, setOauthSecretDrafts] = useState<
    Record<OAuthProviderId, string>
  >({ apple: "", github: "", google: "" });
  const [wechatSecretDraft, setWechatSecretDraft] = useState("");
  const [projectTypes, setProjectTypes] = useState<EditableProjectType[]>([]);
  const [customTeamGroups, setCustomTeamGroups] = useState<string[]>([]);
  const [newTeamGroup, setNewTeamGroup] = useState("");
  const [uploadingAvatarIndex, setUploadingAvatarIndex] = useState<number | null>(
    null
  );
  const [avatarUploadErrors, setAvatarUploadErrors] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeLabel = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.label ?? "",
    [activeTab]
  );
  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) => {
        const permission = tabPermissions[tab.id];

        if (
          tab.id === "database" &&
          currentAdmin?.role !== "owner" &&
          currentAdmin?.role !== "admin"
        ) {
          return false;
        }

        return (
          !permission ||
          currentAdmin?.role === "owner" ||
          currentAdmin?.permissions.includes(permission)
        );
      }),
    [currentAdmin]
  );
  const canSaveContent =
    contentTabs.includes(activeTab) &&
    Boolean(
      currentAdmin?.role === "owner" ||
        currentAdmin?.permissions.includes("content.write")
    );
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...projectTypes.map((type) => type.category),
          ...(data?.works.map((work) => work.category) ?? [])
        ].map((item) => item.trim()).filter(Boolean))
      ),
    [data?.works, projectTypes]
  );
  const teamGroupOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...defaultTeamGroups,
            ...(data?.teamMembers.map((member) => member.group) ?? []),
            ...customTeamGroups
          ]
            .map((group) => group.trim())
            .filter(Boolean)
        )
      ),
    [customTeamGroups, data?.teamMembers]
  );

  async function loadContent() {
    const response = await fetch("/_wcu-api/admin/content", { cache: "no-store" });

    if (!response.ok) {
      if (response.status === 401) {
        setAuthenticated(false);
        setError("登录已失效，请重新登录后台。");
      }

      setData(null);
      return;
    }

    setData((await response.json()) as SiteData);
  }

  async function loadDatabaseStats() {
    const response = await fetch("/_wcu-api/admin/database", { cache: "no-store" });

    if (!response.ok) {
      setDatabaseStats(null);
      return;
    }

    setDatabaseStats((await response.json()) as DatabaseStats);
  }

  async function loadProjectTypes() {
    const response = await fetch("/_wcu-api/admin/project-types", { cache: "no-store" });

    if (!response.ok) {
      setProjectTypes([]);
      return;
    }

    const result = (await response.json()) as { types?: ProjectType[] };
    setProjectTypes(Array.isArray(result.types) ? result.types : []);
  }

  async function loadLoginSettings() {
    const response = await fetch("/_wcu-api/admin/login-settings", {
      cache: "no-store"
    });

    if (!response.ok) {
      setLoginSettings(emptyLoginSettings);
      return;
    }

    setLoginSettings((await response.json()) as LoginSettings);
    setOauthSecretDrafts({ apple: "", github: "", google: "" });
    setWechatSecretDraft("");
  }

  useEffect(() => {
    async function boot() {
      const response = await fetch("/_wcu-api/admin/me", { cache: "no-store" });
      const result = (await response.json()) as {
        authenticated: boolean;
        user?: CurrentAdmin | null;
      };
      setAuthenticated(result.authenticated);
      setCurrentAdmin(result.user ?? null);

      if (result.authenticated) {
        await loadContent();
        await loadProjectTypes();
        await loadLoginSettings();
        await loadDatabaseStats();
      }

      setLoading(false);
    }

    void boot();
  }, []);

  async function logout() {
    await fetch("/_wcu-api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setCurrentAdmin(null);
    setData(null);
    setDatabaseStats(null);
    setLoginSettings(emptyLoginSettings);
    setOauthSecretDrafts({ apple: "", github: "", google: "" });
    setWechatSecretDraft("");
    setProjectTypes([]);
  }

  async function save() {
    if (!data) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/_wcu-api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = (await response.json().catch(() => null)) as null | {
        data?: SiteData;
        message?: string;
      };

      if (!response.ok) {
        setError(result?.message ?? "保存失败");
        return;
      }

      if (result?.data) {
        setData(result.data);
      }

      setMessage("已保存。刷新前台页面即可看到最新内容。");
      await loadDatabaseStats();
    } catch {
      setError("网络暂时不可用，本次修改未保存。");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    setData(defaultSiteData);
    setMessage("已恢复为默认内容，点击保存后才会写入。");
  }

  function updateWechatLogin(patch: Partial<LoginSettings["wechat"]>) {
    setLoginSettings((current) => ({
      ...current,
      wechat: {
        ...current.wechat,
        ...patch
      }
    }));
  }

  function updateOAuthLogin(
    provider: OAuthProviderId,
    patch: Partial<OAuthLoginSettings>
  ) {
    setLoginSettings((current) => ({
      ...current,
      oauth: {
        ...current.oauth,
        [provider]: {
          ...current.oauth[provider],
          ...patch
        }
      }
    }));
  }

  async function saveLoginSettings() {
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/_wcu-api/admin/login-settings", {
      body: JSON.stringify({
        ...loginSettings,
        oauth: Object.fromEntries(
          oauthProviderIds.map((provider) => [
            provider,
            {
              ...loginSettings.oauth[provider],
              clientSecret: oauthSecretDrafts[provider]
            }
          ])
        ),
        wechat: {
          ...loginSettings.wechat,
          appSecret: wechatSecretDraft
        }
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT"
    });
    const result = (await response.json().catch(() => null)) as null | {
      message?: string;
      settings?: LoginSettings;
    };

    setSaving(false);

    if (!response.ok || !result?.settings) {
      setError(result?.message ?? "登录设置保存失败。");
      return;
    }

    setLoginSettings(result.settings);
    setOauthSecretDrafts({ apple: "", github: "", google: "" });
    setWechatSecretDraft("");
    setMessage("登录设置已保存，刷新登录页即可看到最新配置。");
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

  function updateTeamMember(index: number, patch: Partial<TeamMember>) {
    setData((current) =>
      current
        ? {
            ...current,
            teamMembers: current.teamMembers.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            )
          }
        : current
    );
  }

  function addTeamMember() {
    setData((current) =>
      current
        ? {
            ...current,
            teamMembers: [
              ...current.teamMembers,
              {
                avatar: "",
                bio: "",
                expertise: [],
                group: "核心团队",
                highlights: [],
                name: "新成员",
                role: "团队成员",
                slug: nextTeamMemberSlug(current.teamMembers)
              }
            ]
          }
        : current
    );
    setMessage("已新增人物，请补充资料并点击右上角“保存”。");
  }

  function addTeamGroup() {
    const group = newTeamGroup.trim();

    if (!group) {
      setError("请输入要新增的团队分组名称。");
      return;
    }

    setCustomTeamGroups((current) =>
      current.includes(group) ? current : [...current, group]
    );
    setNewTeamGroup("");
    setError("");
    setMessage(`已新增分组“${group}”，请在人物资料中选择该分组并保存。`);
  }

  async function uploadTeamAvatar(index: number, file: File) {
    if (!file.type.startsWith("image/")) {
      setAvatarUploadErrors((current) => ({
        ...current,
        [index]: "请选择 JPG、PNG、WebP 等图片文件。"
      }));
      return;
    }

    setUploadingAvatarIndex(index);
    setAvatarUploadErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/_wcu-api/admin/media", {
        body,
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as null | {
        message?: string;
        ok?: boolean;
        url?: string;
      };

      if (!response.ok || !result?.ok || !result.url) {
        setAvatarUploadErrors((current) => ({
          ...current,
          [index]: result?.message ?? "人物照片上传失败，请稍后重试。"
        }));
        return;
      }

      updateTeamMember(index, { avatar: result.url });
      setMessage("人物照片已上传并回填，请点击右上角“保存”同步到前台。");
    } catch {
      setAvatarUploadErrors((current) => ({
        ...current,
        [index]: "网络暂时不可用，人物照片未上传。"
      }));
    } finally {
      setUploadingAvatarIndex(null);
    }
  }

  function removeTeamMember(index: number) {
    const member = data?.teamMembers[index];

    if (!member || !window.confirm(`确认删除“${member.name}”吗？保存后前台详情页将同步移除。`)) {
      return;
    }

    setData((current) =>
      current
        ? {
            ...current,
            teamMembers: current.teamMembers.filter(
              (_item, itemIndex) => itemIndex !== index
            )
          }
        : current
    );
    setMessage(`已移除“${member.name}”，点击右上角“保存”后生效。`);
  }

  function moveTeamMember(index: number, offset: -1 | 1) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const targetIndex = index + offset;

      if (targetIndex < 0 || targetIndex >= current.teamMembers.length) {
        return current;
      }

      const teamMembers = [...current.teamMembers];
      [teamMembers[index], teamMembers[targetIndex]] = [
        teamMembers[targetIndex],
        teamMembers[index]
      ];

      return { ...current, teamMembers };
    });
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

  function addProjectType() {
    const sortOrder =
      projectTypes.reduce((max, item) => Math.max(max, Number(item.sortOrder) || 0), 0) + 10;

    setProjectTypes((current) => [
      ...current,
      {
        active: true,
        category: "新分类",
        createdAt: "",
        description: "",
        draft: true,
        id: `draft-${Date.now()}`,
        label: "新类型",
        slug: "",
        sortOrder,
        updatedAt: ""
      }
    ]);
    setActiveTab("types");
  }

  function updateProjectType(id: string, patch: Partial<EditableProjectType>) {
    setProjectTypes((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  async function saveProjectType(item: EditableProjectType) {
    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/_wcu-api/admin/project-types", {
      body: JSON.stringify({
        active: item.active,
        category: item.category,
        description: item.description,
        id: item.draft ? undefined : item.id,
        label: item.label,
        sortOrder: item.sortOrder
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const result = (await response.json().catch(() => null)) as null | {
      message?: string;
      type?: ProjectType;
    };

    setSaving(false);

    if (!response.ok || !result?.type) {
      setError(result?.message ?? "类型保存失败。");
      return;
    }

    setProjectTypes((current) =>
      current.map((currentItem) => (currentItem.id === item.id ? result.type! : currentItem))
    );
    setMessage(`已保存类型「${result.type.label}」。`);
    await loadDatabaseStats();
  }

  async function deleteProjectTypeItem(item: EditableProjectType) {
    if (item.draft) {
      setProjectTypes((current) => current.filter((currentItem) => currentItem.id !== item.id));
      return;
    }

    if (!window.confirm(`确认删除类型「${item.label}」吗？已有项目会保留原类型文本。`)) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const response = await fetch("/_wcu-api/admin/project-types", {
      body: JSON.stringify({ id: item.id }),
      headers: { "Content-Type": "application/json" },
      method: "DELETE"
    });
    const result = (await response.json().catch(() => null)) as null | {
      message?: string;
    };

    setSaving(false);

    if (!response.ok) {
      setError(result?.message ?? "类型删除失败。");
      return;
    }

    setProjectTypes((current) => current.filter((currentItem) => currentItem.id !== item.id));
    setMessage(`已删除类型「${item.label}」。`);
    await loadDatabaseStats();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 py-12">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-cyan-100" />
      </div>
    );
  }

  if (!authenticated) {
    return <AdminLogin sessionError={error} />;
  }

  if (!data) {
    return (
      <section className="mx-auto min-h-screen max-w-4xl px-5 py-20">
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
    <section className="min-h-screen px-5 py-12 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
              unified platform
            </p>
            <h1 className="mt-4 text-4xl font-semibold text-stone-50 md:text-6xl">
              战纪宇宙统一平台
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-400">
              当前模块：{activeLabel}。官网内容、用户项目、MySQL 数据库、灵穹知识库与灵穹 API 网关集中在这一个后台管理。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canSaveContent ? (
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                onClick={resetToDefault}
                type="button"
              >
                恢复默认
              </button>
            ) : null}
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              onClick={logout}
              type="button"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              退出
            </button>
            {canSaveContent ? (
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
            ) : null}
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
          {visibleTabs.map((tab) => (
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
          {activeTab === "overview" ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    icon: LayoutDashboard,
                    label: "官网内容",
                    value: databaseStats?.counts.siteContent ?? "-",
                    note: "品牌、作品、服务与页面媒体"
                  },
                  {
                    icon: Boxes,
                    label: "类型分类",
                    value: databaseStats?.counts.projectTypes ?? "-",
                    note: "创建页类型与前台作品分类"
                  },
                  {
                    icon: UsersRound,
                    label: "注册用户",
                    value: databaseStats?.counts.frontUsers ?? "-",
                    note: "邀请码注册后的前台用户"
                  },
                  {
                    icon: KeyRound,
                    label: "统一登录",
                    value: loginSettings.wechat.enabled ? "微信开启" : "微信关闭",
                    note: "后台密码与微信扫码登录配置"
                  },
                  {
                    icon: Clapperboard,
                    label: "创作项目",
                    value: databaseStats?.counts.projects ?? "-",
                    note: "生产线进入画布后的项目"
                  },
                  {
                    icon: PlugZap,
                    label: "模型调用",
                    value: databaseStats?.counts.modelApiCalls ?? "-",
                    note: "画布通过网关发起的生成"
                  },
                  {
                    icon: WandSparkles,
                    label: "Skill 工具",
                    value: databaseStats?.counts.skillTools ?? "-",
                    note: "用户可直接调用的 Skill"
                  },
                  {
                    icon: BookOpen,
                    label: "知识库",
                    value: "已接入",
                    note: "灵穹知识库文档、设定与生产规范"
                  }
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <article
                      className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
                      key={item.label}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5 text-cyan-100" />
                      <p className="mt-5 text-xs text-stone-500">{item.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-stone-50">
                        {item.value}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-stone-500">
                        {item.note}
                      </p>
                    </article>
                  );
                })}
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                <Card title="一体化后台结构">
                  <div className="space-y-3 text-sm leading-7 text-stone-400">
                    <p>官网内容由战纪宇宙后台维护，写入 MySQL。</p>
                    <p>模型渠道、令牌、额度和调用日志由灵穹 API 网关承接。</p>
                    <p>Skill 工作台已合并为站内模块，统一使用 /skills 和站内 API。</p>
                    <p>灵穹知识库通过 /knowledge 提供站内页面树与多维表格，历史 BookStack 资料保留在 /bookstack/。</p>
                    <p>前台画布只调用站内接口，再由服务端转发到统一模型网关。</p>
                  </div>
                </Card>
                <Card title="快捷入口">
                  <div className="grid gap-3">
                    {[
                      { id: "brand" as AdminTab, label: "编辑官网内容" },
                      { id: "types" as AdminTab, label: "管理类型分类" },
                      { id: "skills" as AdminTab, label: "管理 Skill 工具" },
                      { id: "login" as AdminTab, label: "配置统一登录" },
                      { id: "knowledge" as AdminTab, label: "进入知识库" },
                      { id: "api" as AdminTab, label: "进入 API 网关" },
                      { id: "database" as AdminTab, label: "查看数据库" },
                      { id: "users" as AdminTab, label: "管理后台账号" },
                      { id: "audit" as AdminTab, label: "查看审计日志" }
                    ].filter((item) => visibleTabs.some((tab) => tab.id === item.id)).map((item) => (
                      <button
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-left text-sm font-semibold text-stone-100 transition hover:border-cyan-200/50 hover:text-cyan-50"
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        type="button"
                      >
                        {item.label}
                        <Boxes aria-hidden="true" className="h-4 w-4 text-cyan-100" />
                      </button>
                    ))}
                  </div>
                </Card>
                <Card title="统一调用链">
                  <div className="rounded-lg border border-cyan-200/15 bg-cyan-200/10 p-4 text-xs leading-6 text-cyan-50/80">
                    官网与画布 → /_wcu-api → 战纪宇宙服务端 → /v1 → 灵穹 API → 模型渠道
                  </div>
                  <p className="mt-4 text-sm leading-7 text-stone-400">
                    管理员只需要进入这个后台，即可维护官网、检查数据、配置模型并打开网关控制台。
                  </p>
                </Card>
              </div>
            </div>
          ) : null}

          {activeTab === "brand" ? (
            <div className="grid gap-5 xl:grid-cols-3">
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
              <Card title="首页媒体">
                <div className="grid gap-4">
                  <Field
                    label="首页静态背景图"
                    onChange={(value) =>
                      setData({ ...data, media: { ...data.media, hero: value } })
                    }
                    value={data.media.hero}
                  />
                  <Field
                    label="首页动态背景视频"
                    onChange={(value) =>
                      setData({ ...data, media: { ...data.media, heroVideo: value } })
                    }
                    value={data.media.heroVideo}
                  />
                  <Field
                    label="《火种》概念图"
                    onChange={(value) =>
                      setData({ ...data, media: { ...data.media, spark: value } })
                    }
                    value={data.media.spark}
                  />
                  <Field
                    label="生产线视觉"
                    onChange={(value) =>
                      setData({ ...data, media: { ...data.media, workflow: value } })
                    }
                    value={data.media.workflow}
                  />
                  <Field
                    label="世界观视觉"
                    onChange={(value) =>
                      setData({ ...data, media: { ...data.media, generations: value } })
                    }
                    value={data.media.generations}
                  />
                  <Field
                    label="服务视觉"
                    onChange={(value) =>
                      setData({ ...data, media: { ...data.media, services: value } })
                    }
                    value={data.media.services}
                  />
                  <p className="rounded-lg border border-cyan-200/15 bg-cyan-200/10 px-3 py-2 text-xs leading-6 text-cyan-50/80">
                    视频可填写 /media/xxx.mp4、/media/xxx.webm 或外部视频地址；留空则只显示静态背景图。
                  </p>
                </div>
              </Card>
              <div className="xl:col-span-3">
                <Card title="团队与顾问">
                  <div className="mb-5 flex flex-col gap-4 rounded-lg border border-cyan-200/15 bg-cyan-200/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-6 text-cyan-50/80">
                      可新增、编辑、排序和删除人物。详情页地址必须唯一；所有修改点击页面右上角“保存”后同步到关于页和人物详情页。
                    </p>
                    <button
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white"
                      onClick={addTeamMember}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      新增人物
                    </button>
                  </div>
                  <div className="mb-5 grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="text-xs font-medium text-stone-400">
                        新增自定义分组
                      </span>
                      <input
                        className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
                        onChange={(event) => setNewTeamGroup(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addTeamGroup();
                          }
                        }}
                        placeholder="例如：技术顾问、联合出品人"
                        value={newTeamGroup}
                      />
                    </label>
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/20"
                      onClick={addTeamGroup}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      新增分组
                    </button>
                  </div>
                  <div className="grid gap-5">
                    {data.teamMembers.map((member, index) => (
                      <div
                        className="rounded-lg border border-white/10 bg-zinc-950/40 p-4"
                        key={member.slug}
                      >
                        <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold text-cyan-100">
                              第 {String(index + 1).padStart(2, "0")} 位
                            </p>
                            <p className="mt-1 text-sm text-stone-400">
                              {member.name || "未命名人物"} · {member.group}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <a
                              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-stone-200 transition hover:border-cyan-200/50 hover:text-cyan-100"
                              href={`/about/team/${encodeURIComponent(member.slug)}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                              预览
                            </a>
                            <button
                              aria-label={`上移${member.name}`}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-stone-200 transition hover:border-cyan-200/50 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
                              disabled={index === 0}
                              onClick={() => moveTeamMember(index, -1)}
                              title="上移"
                              type="button"
                            >
                              <ArrowUp aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`下移${member.name}`}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-stone-200 transition hover:border-cyan-200/50 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-30"
                              disabled={index === data.teamMembers.length - 1}
                              onClick={() => moveTeamMember(index, 1)}
                              title="下移"
                              type="button"
                            >
                              <ArrowDown aria-hidden="true" className="h-4 w-4" />
                            </button>
                            <button
                              aria-label={`删除${member.name}`}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-red-300/25 text-red-100 transition hover:bg-red-400/10"
                              onClick={() => removeTeamMember(index)}
                              title="删除"
                              type="button"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field
                            label="姓名"
                            onChange={(value) => updateTeamMember(index, { name: value })}
                            value={member.name}
                          />
                          <Field
                            label="岗位"
                            onChange={(value) => updateTeamMember(index, { role: value })}
                            value={member.role}
                          />
                          <SelectField
                            label="分组"
                            onChange={(value) =>
                              updateTeamMember(index, {
                                group: value as TeamMember["group"]
                              })
                            }
                            options={teamGroupOptions}
                            value={member.group}
                          />
                          <Field
                            label="详情页地址（小写字母、数字、连字符）"
                            onChange={(value) =>
                              updateTeamMember(index, { slug: value.toLowerCase() })
                            }
                            value={member.slug}
                          />
                          <div className="md:col-span-2">
                            <Field
                              label="人物照片地址"
                              onChange={(value) => updateTeamMember(index, { avatar: value })}
                              value={member.avatar}
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.035] px-4 text-xs font-semibold text-stone-100 transition hover:border-cyan-200/45 hover:bg-cyan-200/10">
                                {uploadingAvatarIndex === index ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="h-4 w-4 animate-spin"
                                  />
                                ) : (
                                  <Upload aria-hidden="true" className="h-4 w-4" />
                                )}
                                {uploadingAvatarIndex === index
                                  ? "照片上传中"
                                  : "选择并上传照片"}
                                <input
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  className="sr-only"
                                  disabled={uploadingAvatarIndex !== null}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];

                                    if (file) {
                                      void uploadTeamAvatar(index, file);
                                    }

                                    event.target.value = "";
                                  }}
                                  type="file"
                                />
                              </label>
                              <span className="text-xs text-stone-500">
                                上传成功后会自动回填站内图片地址。
                              </span>
                            </div>
                            {avatarUploadErrors[index] ? (
                              <p
                                className="mt-3 flex items-start gap-2 text-xs leading-6 text-red-200"
                                role="alert"
                              >
                                <XCircle
                                  aria-hidden="true"
                                  className="mt-1 h-3.5 w-3.5 shrink-0"
                                />
                                {avatarUploadErrors[index]}
                              </p>
                            ) : null}
                          </div>
                          <div className="md:col-span-2">
                            <Field
                              label="人物详细简介"
                              multiline
                              onChange={(value) => updateTeamMember(index, { bio: value })}
                              value={member.bio}
                            />
                          </div>
                          <Field
                            label="专业方向（每行一项）"
                            multiline
                            onChange={(value) =>
                              updateTeamMember(index, { expertise: fromLines(value) })
                            }
                            value={toLines(member.expertise)}
                          />
                          <Field
                            label="履历亮点（每行一项）"
                            multiline
                            onChange={(value) =>
                              updateTeamMember(index, { highlights: fromLines(value) })
                            }
                            value={toLines(member.highlights)}
                          />
                        </div>
                      </div>
                    ))}
                    {!data.teamMembers.length ? (
                      <div className="rounded-lg border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm text-stone-500">
                        暂无人物，点击“新增人物”开始创建。
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
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
                        category: categoryOptions[0] ?? "战纪宇宙",
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
                      <SelectField
                        label="关联分类"
                        onChange={(value) => updateWork(index, { category: value })}
                        options={categoryOptions}
                        value={work.category}
                      />
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

          {activeTab === "types" ? (
            <div className="space-y-5">
              <Card title="类型与前台分类关系">
                <div className="grid gap-4 text-sm leading-7 text-stone-400 lg:grid-cols-3">
                  <p>类型名称会显示在创作者工作台的新建项目弹窗中。</p>
                  <p>关联分类会同步到作品页筛选，并用于后台作品内容归类。</p>
                  <p>停用后前台新建项目不再显示，但已有项目仍保留原类型文本。</p>
                </div>
              </Card>

              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                onClick={addProjectType}
                type="button"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                添加类型
              </button>

              {projectTypes.length ? (
                projectTypes.map((item) => (
                  <Card
                    key={item.id}
                    onDelete={() => void deleteProjectTypeItem(item)}
                    title={item.label || "未命名类型"}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="类型名称（创建页按钮）"
                        onChange={(value) => updateProjectType(item.id, { label: value })}
                        value={item.label}
                      />
                      <Field
                        label="前台关联分类（作品筛选）"
                        onChange={(value) => updateProjectType(item.id, { category: value })}
                        value={item.category}
                      />
                      <Field
                        label="排序"
                        onChange={(value) =>
                          updateProjectType(item.id, { sortOrder: Number(value) || 0 })
                        }
                        type="number"
                        value={String(item.sortOrder)}
                      />
                      <label className="flex min-h-[68px] items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/55 px-4 py-3">
                        <input
                          checked={item.active}
                          className="h-4 w-4 accent-cyan-200"
                          onChange={(event) =>
                            updateProjectType(item.id, { active: event.target.checked })
                          }
                          type="checkbox"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-stone-100">
                            前台启用
                          </span>
                          <span className="mt-1 block text-xs text-stone-500">
                            开启后会出现在创建页类型按钮和作品分类中。
                          </span>
                        </span>
                      </label>
                      <div className="md:col-span-2">
                        <Field
                          label="类型说明"
                          multiline
                          onChange={(value) =>
                            updateProjectType(item.id, { description: value })
                          }
                          value={item.description}
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={saving}
                        onClick={() => void saveProjectType(item)}
                        type="button"
                      >
                        {saving ? (
                          <Loader2
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin"
                          />
                        ) : (
                          <Save aria-hidden="true" className="h-4 w-4" />
                        )}
                        保存类型
                      </button>
                      <span className="text-xs text-stone-500">
                        {item.draft ? "尚未写入数据库" : `slug: ${item.slug}`}
                      </span>
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

          {activeTab === "login" ? (
            <div className="space-y-5">
              <Card title="统一登录设置">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
                  <div className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-5">
                    <QrCode aria-hidden="true" className="h-6 w-6 text-cyan-100" />
                    <h2 className="mt-4 text-2xl font-semibold text-stone-50">
                      微信扫码登录
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-stone-300">
                      这里控制登录页的微信入口。扫码登录会创建或复用前台创作者身份，并统一进入创作台、灵穹 API 与灵穹知识库；后台管理仍由管理员密码控制。
                    </p>
                    <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4 text-xs leading-6 text-stone-400">
                      本地模式生成站内测试二维码；微信开放平台模式会跳转微信官方授权页，并以 openid/unionid 创建或复用独立前台用户。正式回调地址为 https://pla.wiki/_wcu-api/auth/wechat/callback。
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <label className="flex min-h-[68px] items-center gap-3 rounded-lg border border-white/10 bg-zinc-950/55 px-4 py-3">
                      <input
                        checked={loginSettings.wechat.enabled}
                        className="h-4 w-4 accent-cyan-200"
                        onChange={(event) =>
                          updateWechatLogin({ enabled: event.target.checked })
                        }
                        type="checkbox"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-stone-100">
                          启用微信授权登录
                        </span>
                        <span className="mt-1 block text-xs text-stone-500">
                          关闭后登录页只保留管理员密码入口。
                        </span>
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-stone-400">
                        微信登录模式
                      </span>
                      <select
                        className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-stone-100 outline-none transition focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-200/15"
                        onChange={(event) =>
                          updateWechatLogin({
                            mode: event.target.value as LoginSettings["wechat"]["mode"]
                          })
                        }
                        value={loginSettings.wechat.mode}
                      >
                        <option value="local-scan">站内扫码确认</option>
                        <option value="official">微信公众号网页授权</option>
                      </select>
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field
                        label="二维码标题"
                        onChange={(value) => updateWechatLogin({ qrTitle: value })}
                        value={loginSettings.wechat.qrTitle}
                      />
                      <Field
                        label="默认用户名称"
                        onChange={(value) => updateWechatLogin({ defaultAccount: value })}
                        value={loginSettings.wechat.defaultAccount}
                      />
                      <Field
                        label="默认微信标识"
                        onChange={(value) => updateWechatLogin({ defaultContact: value })}
                        value={loginSettings.wechat.defaultContact}
                      />
                      <Field
                        label="微信 AppID"
                        onChange={(value) => updateWechatLogin({ appId: value })}
                        value={loginSettings.wechat.appId}
                      />
                      <Field
                        label={
                          loginSettings.wechat.appSecretConfigured
                            ? "微信 AppSecret（已配置，留空保留）"
                            : "微信 AppSecret（尚未配置）"
                        }
                        onChange={setWechatSecretDraft}
                        type="password"
                        value={wechatSecretDraft}
                      />
                    </div>
                    <Field
                      label="二维码说明"
                      multiline
                      onChange={(value) => updateWechatLogin({ qrHint: value })}
                      value={loginSettings.wechat.qrHint}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={saving}
                        onClick={() => void saveLoginSettings()}
                        type="button"
                      >
                        {saving ? (
                          <Loader2
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin"
                          />
                        ) : (
                          <Save aria-hidden="true" className="h-4 w-4" />
                        )}
                        保存登录设置
                      </button>
                      <a
                        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
                        href="/login"
                        rel="noreferrer"
                        target="_blank"
                      >
                        预览登录页
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="第三方登录设置">
                <div className="space-y-4">
                  <p className="text-sm leading-7 text-stone-400">
                    Google、GitHub、Apple 都会进入同一个战纪宇宙平台会话。请在对应平台创建 OAuth 应用，并把回调地址设置为
                    <span className="mx-1 rounded bg-black/30 px-2 py-1 font-mono text-xs text-cyan-100">
                      http://127.0.0.1/_wcu-api/auth/oauth/callback/服务名
                    </span>
                    ，例如 google、github、apple。
                  </p>

                  <div className="grid gap-4">
                    {oauthProviderIds.map((provider) => {
                      const oauth = loginSettings.oauth[provider];

                      return (
                        <div
                          className="rounded-lg border border-white/10 bg-zinc-950/45 p-4"
                          key={provider}
                        >
                          <label className="flex items-center gap-3">
                            <input
                              checked={oauth.enabled}
                              className="h-4 w-4 accent-cyan-200"
                              onChange={(event) =>
                                updateOAuthLogin(provider, {
                                  enabled: event.target.checked
                                })
                              }
                              type="checkbox"
                            />
                            <span>
                              <span className="block text-sm font-semibold text-stone-100">
                                启用 {oauth.label} 登录
                              </span>
                              <span className="mt-1 block text-xs text-stone-500">
                                前台只在启用且 Client ID / Secret 填写完整后显示按钮。
                              </span>
                            </span>
                          </label>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field
                              label="显示名称"
                              onChange={(value) => updateOAuthLogin(provider, { label: value })}
                              value={oauth.label}
                            />
                            <Field
                              label="Client ID"
                              onChange={(value) => updateOAuthLogin(provider, { clientId: value })}
                              value={oauth.clientId}
                            />
                            <Field
                              label={
                                oauth.clientSecretConfigured
                                  ? "Client Secret（已配置，留空保留）"
                                  : "Client Secret（尚未配置）"
                              }
                              onChange={(value) =>
                                setOauthSecretDrafts((current) => ({
                                  ...current,
                                  [provider]: value
                                }))
                              }
                              type="password"
                              value={oauthSecretDrafts[provider]}
                            />
                            <Field
                              label="Scopes"
                              onChange={(value) => updateOAuthLogin(provider, { scopes: value })}
                              value={oauth.scopes}
                            />
                            <Field
                              label="授权地址"
                              onChange={(value) =>
                                updateOAuthLogin(provider, { authorizeUrl: value })
                              }
                              value={oauth.authorizeUrl}
                            />
                            <Field
                              label="Token 地址"
                              onChange={(value) => updateOAuthLogin(provider, { tokenUrl: value })}
                              value={oauth.tokenUrl}
                            />
                            <Field
                              label="用户资料地址"
                              onChange={(value) =>
                                updateOAuthLogin(provider, { userInfoUrl: value })
                              }
                              value={oauth.userInfoUrl}
                            />
                            <Field
                              label="用户名字段"
                              onChange={(value) =>
                                updateOAuthLogin(provider, { accountClaim: value })
                              }
                              value={oauth.accountClaim}
                            />
                            <Field
                              label="联系方式字段"
                              onChange={(value) =>
                                updateOAuthLogin(provider, { contactClaim: value })
                              }
                              value={oauth.contactClaim}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={saving}
                      onClick={() => void saveLoginSettings()}
                      type="button"
                    >
                      {saving ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save aria-hidden="true" className="h-4 w-4" />
                      )}
                      保存第三方登录
                    </button>
                  </div>
                </div>
              </Card>

              <Card title="统一登录链路">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ["创作者", "微信或第三方登录后写入平台会话，进入 /projects 与生产工作台。"],
                    ["灵穹 API", "API 首页与控制台复用平台会话，不再二次登录。"],
                    ["灵穹知识库", "知识空间、页面树与多维表格复用平台会话，数据统一写入 MySQL。"]
                  ].map(([title, summary]) => (
                    <div
                      className="rounded-lg border border-white/10 bg-black/20 p-4"
                      key={title}
                    >
                      <p className="text-sm font-semibold text-stone-100">{title}</p>
                      <p className="mt-2 text-xs leading-6 text-stone-500">{summary}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {activeTab === "knowledge" ? (
            <div className="space-y-5">
              <Card title="灵穹知识库">
                <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
                  <div className="rounded-lg border border-cyan-200/20 bg-cyan-200/10 p-5">
                    <BookOpen aria-hidden="true" className="h-6 w-6 text-cyan-100" />
                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
                      knowledge base
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-stone-50">
                      灵穹知识库
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-stone-300">
                      以飞书式知识空间、页面树和多维表格沉淀世界观、角色设定、剧本资料、生产规范与素材台账。
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <a
                        className="inline-flex items-center gap-2 rounded-lg bg-stone-50 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
                        href="/knowledge"
                        rel="noreferrer"
                        target="_blank"
                      >
                        打开知识库
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["统一入口", "/knowledge"],
                      ["工作模式", "知识空间 + 页面树 + 多维表格"],
                      ["站内 API", "/_wcu-api/knowledge"],
                      ["业务数据库", "zhanji_universe"],
                      ["并发保护", "revision 乐观锁"],
                      ["历史资料", "/bookstack/"],
                      ["权限映射", "creator 所有权 / admin projects.read-write"]
                    ].map(([label, value]) => (
                      <div
                        className="rounded-lg border border-white/10 bg-black/20 p-4"
                        key={label}
                      >
                        <p className="text-xs text-stone-500">{label}</p>
                        <p className="mt-2 break-all text-sm font-semibold text-stone-100">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card title="建议栏目">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ["战纪宇宙设定", "世界观年表、时代线、人物关系与关键词。"],
                    ["项目制作手册", "从创意、剧集、资产、分镜到交付的可复用流程。"],
                    ["模型与提示词库", "灵穹 API 模型说明、风格词、镜头词和禁用项。"]
                  ].map(([title, summary]) => (
                    <div
                      className="rounded-lg border border-white/10 bg-black/20 p-4"
                      key={title}
                    >
                      <p className="text-sm font-semibold text-stone-100">{title}</p>
                      <p className="mt-2 text-xs leading-6 text-stone-500">{summary}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : null}

          {activeTab === "skills" ? <SkillAdmin /> : null}

          {activeTab === "api" ? (
            <div className="space-y-5">
              <NewApiConsole />
              <ModelApiAdmin />
            </div>
          ) : null}

          {activeTab === "users" && currentAdmin ? (
            <AdminSecurityAdmin currentUser={currentAdmin} mode="users" />
          ) : null}

          {activeTab === "audit" && currentAdmin ? (
            <AdminSecurityAdmin currentUser={currentAdmin} mode="audit" />
          ) : null}

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
                          MySQL 已启用
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
                        ["类型分类", databaseStats.counts.projectTypes],
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
