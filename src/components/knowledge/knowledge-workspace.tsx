"use client";

import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Code2,
  Columns3,
  Copy,
  Download,
  Database,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Grid3X3,
  Heading1,
  Hash,
  Home,
  LayoutDashboard,
  Link2,
  ListFilter,
  Loader2,
  Menu,
  MessageSquare,
  Minus,
  MoreHorizontal,
  Plus,
  Quote,
  RefreshCw,
  Rows3,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Table2,
  Text,
  Trash2,
  Upload,
  Users,
  X,
  Zap
} from "lucide-react";

import { cn } from "@/lib/utils";
import styles from "./knowledge-workspace.module.css";

type KnowledgeSpace = {
  color: string;
  createdAt: string;
  description: string;
  icon: string;
  id: string;
  ownerAccount?: string;
  ownerId: string;
  revision: number;
  title: string;
  updatedAt: string;
};

type KnowledgePage = {
  content: Record<string, unknown>;
  createdAt: string;
  icon: string;
  id: string;
  pageType: "document" | "table" | "link";
  parentId?: string;
  revision: number;
  slug: string;
  sortOrder: number;
  spaceId: string;
  title: string;
  updatedAt: string;
};

type KnowledgeTable = {
  createdAt: string;
  description: string;
  icon: string;
  id: string;
  revision: number;
  spaceId: string;
  title: string;
  updatedAt: string;
};

type FieldType =
  | "attachment"
  | "autonumber"
  | "barcode"
  | "button"
  | "checkbox"
  | "created_time"
  | "currency"
  | "date"
  | "email"
  | "formula"
  | "location"
  | "lookup"
  | "multi_select"
  | "number"
  | "person"
  | "phone"
  | "progress"
  | "rating"
  | "relation"
  | "select"
  | "text"
  | "updated_time"
  | "url";

type KnowledgeField = {
  config: Record<string, unknown>;
  createdAt: string;
  fieldType: FieldType;
  id: string;
  name: string;
  revision: number;
  sortOrder: number;
  tableId: string;
  updatedAt: string;
};

type KnowledgeRecord = {
  createdAt: string;
  createdByAccount?: string;
  id: string;
  revision: number;
  sortOrder: number;
  tableId: string;
  updatedAt: string;
  updatedByAccount?: string;
  values: Record<string, unknown>;
};

type ViewType = "calendar" | "form" | "gallery" | "gantt" | "grid" | "kanban";
type DisplayMode = ViewType;

type BlockType =
  | "callout"
  | "code"
  | "divider"
  | "heading1"
  | "heading2"
  | "paragraph"
  | "quote"
  | "todo";

type DocumentBlock = {
  checked?: boolean;
  id: string;
  text: string;
  type: BlockType;
};

type WorkspacePanel =
  | "automation"
  | "comments"
  | "dashboard"
  | "field-settings"
  | "filter"
  | "form"
  | "gantt"
  | "group"
  | "history"
  | "import-export"
  | "more"
  | "notifications"
  | "row-height"
  | "share"
  | "sort"
  | "trash"
  | "view-settings";

type KnowledgeMemberRole = "commenter" | "editor" | "owner" | "viewer";
type KnowledgeAccessRole = KnowledgeMemberRole | "admin";
type KnowledgeSpaceMember = {
  account?: string;
  createdAt: string;
  id: string;
  revision: number;
  role: KnowledgeMemberRole;
  spaceId: string;
  updatedAt: string;
  userId: string;
};

type KnowledgeComment = {
  authorAccount?: string;
  authorId: string;
  body: string;
  createdAt: string;
  id: string;
  parentCommentId?: string;
  revision: number;
  status: "active" | "deleted" | "resolved";
  updatedAt: string;
};

type KnowledgePageVersion = {
  changeSummary: string;
  content: Record<string, unknown>;
  createdAt: string;
  createdByAccount?: string;
  id: string;
  pageRevision: number;
  title: string;
  versionNumber: number;
};

type KnowledgeRecordActivity = {
  action: string;
  actorAccount?: string;
  createdAt: string;
  details: Record<string, unknown>;
  id: string;
};

type KnowledgeAttachment = {
  createdAt: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  id: string;
  mimeType: string;
  revision: number;
  uploadedByAccount?: string;
};

type AutomationTrigger = "field_changed" | "manual" | "record_created" | "record_updated" | "schedule";
type KnowledgeAutomationRule = {
  actions: Record<string, unknown>[];
  createdAt: string;
  enabled: boolean;
  id: string;
  name: string;
  revision: number;
  triggerType: AutomationTrigger;
  updatedAt: string;
};
type KnowledgeAutomationRun = {
  createdAt: string;
  error?: string;
  id: string;
  recordId?: string;
  revision: number;
  ruleId: string;
  status: "failed" | "queued" | "running" | "skipped" | "succeeded";
  updatedAt: string;
};

type RecordDrawerTab = "activity" | "attachments" | "comments" | "fields";
type KnowledgeSearchResult = {
  id: string;
  kind: "page" | "record" | "table";
  snippet: string;
  spaceId: string;
  tableId?: string;
  title: string;
  updatedAt: string;
};

type KnowledgeTrashItem = {
  deletedAt: string;
  deletedByAccount?: string;
  descendantCount?: number;
  id: string;
  resourceType: "page" | "table";
  revision: number;
  title: string;
};

type KnowledgeView = {
  filter: Record<string, unknown>;
  frozenFieldCount: number;
  group: Record<string, unknown>;
  id: string;
  isDefault: boolean;
  name: string;
  revision: number;
  rowHeight: "compact" | "medium" | "tall";
  sort: unknown[];
  tableId: string;
  viewType: ViewType;
  visibleFieldIds: string[];
};

type Dashboard = {
  pageCount: number;
  recentPages: Array<Omit<KnowledgePage, "content">>;
  recentTables: KnowledgeTable[];
  recordCount: number;
  spaceCount: number;
  tableCount: number;
};

type BootstrapResponse = {
  accessRole?: KnowledgeAccessRole;
  dashboard: Dashboard;
  fields?: KnowledgeField[];
  ok: boolean;
  pages?: KnowledgePage[];
  recordHasMore?: boolean;
  recordTotal?: number;
  records?: KnowledgeRecord[];
  space?: KnowledgeSpace;
  spaces: KnowledgeSpace[];
  table?: KnowledgeTable;
  tables?: KnowledgeTable[];
  views?: KnowledgeView[];
};

type CreateKind = "field" | "page" | "space" | "table" | "view";
type WorkspaceMode = "home" | "page" | "table";
type BaseSection = "automation" | "dashboard" | "table";

const apiRoot = "/_wcu-api/knowledge";

const fieldTypeLabels: Record<FieldType, string> = {
  attachment: "附件",
  autonumber: "自动编号",
  barcode: "条码",
  button: "按钮",
  checkbox: "复选框",
  created_time: "创建时间",
  currency: "货币",
  date: "日期",
  email: "邮箱",
  formula: "公式",
  location: "地理位置",
  lookup: "查找引用",
  multi_select: "多选",
  number: "数字",
  person: "成员",
  phone: "电话",
  progress: "进度",
  rating: "评分",
  relation: "关联记录",
  select: "单选",
  text: "文本",
  updated_time: "更新时间",
  url: "链接"
};

const viewTypeLabels: Record<ViewType, string> = {
  calendar: "日历",
  form: "表单",
  gallery: "画册",
  gantt: "甘特",
  grid: "表格",
  kanban: "看板"
};

const viewTypeIcons: Record<ViewType, typeof Grid3X3> = {
  calendar: CalendarDays,
  form: FileText,
  gallery: Rows3,
  gantt: Rows3,
  grid: Grid3X3,
  kanban: Columns3
};

function formatDate(value?: string) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  }).format(date);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function activityLabel(action: string) {
  return ({
    comment_deleted: "删除评论",
    commented: "发表评论",
    created: "创建记录",
    deleted: "删除记录",
    seeded: "初始化记录",
    updated: "更新记录"
  } as Record<string, string>)[action] ?? action;
}

function newBlock(type: BlockType = "paragraph", text = ""): DocumentBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    type
  };
}

function contentToBlocks(content: Record<string, unknown>): DocumentBlock[] {
  if (Array.isArray(content.blocks)) {
    const blocks = content.blocks
      .map((value): DocumentBlock | null => {
        if (!value || typeof value !== "object") return null;
        const item = value as Record<string, unknown>;
        const allowed: BlockType[] = [
          "callout",
          "code",
          "divider",
          "heading1",
          "heading2",
          "paragraph",
          "quote",
          "todo"
        ];
        const type = allowed.includes(item.type as BlockType)
          ? (item.type as BlockType)
          : "paragraph";
        return {
          checked: typeof item.checked === "boolean" ? item.checked : undefined,
          id: typeof item.id === "string" && item.id ? item.id : newBlock().id,
          text:
            typeof item.text === "string"
              ? item.text
              : Array.isArray(item.items)
                ? item.items.map(String).join("\n")
                : "",
          type
        };
      })
      .filter((block): block is DocumentBlock => Boolean(block));
    if (blocks.length) return blocks;
  }
  if (typeof content.text === "string") return [newBlock("paragraph", content.text)];
  return [newBlock()];
}

function pageContent(blocks: DocumentBlock[]) {
  return {
    blocks: blocks.map(({ checked, id, text, type }) => ({ checked, id, text, type })),
    version: 2
  };
}

function stringifyValue(value: unknown) {
  if (Array.isArray(value)) return value.join("、");
  if (typeof value === "boolean") return value ? "是" : "否";
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseInputValue(field: KnowledgeField, value: string | boolean) {
  if (field.fieldType === "checkbox") return Boolean(value);
  if (["currency", "number", "progress", "rating"].includes(field.fieldType)) {
    const parsed = Number(value);
    return value === "" || !Number.isFinite(parsed) ? null : parsed;
  }
  if (field.fieldType === "multi_select") {
    return String(value)
      .split(/[、,，]/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}

function fieldOptions(field: KnowledgeField) {
  const options = field.config.options;
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (typeof option === "string") return option;
      if (option && typeof option === "object" && "label" in option) {
        return String((option as { label: unknown }).label);
      }
      return "";
    })
    .filter(Boolean);
}

type ViewFilterCondition = {
  fieldId: string;
  operator: string;
  value: string;
};

type ViewSortRule = {
  direction: "asc" | "desc";
  fieldId: string;
};

type ViewGroupRule = {
  fieldId: string;
};

const filterOperatorLabels: Record<string, string> = {
  after: "晚于",
  before: "早于",
  contains: "包含",
  equals: "等于",
  greater: "大于",
  is_empty: "为空",
  is_not_empty: "不为空",
  less: "小于",
  not_contains: "不包含",
  not_equals: "不等于"
};

function viewFilterConditions(filter: Record<string, unknown>): ViewFilterCondition[] {
  const conditions = Array.isArray(filter.conditions) ? filter.conditions : [];
  const normalized = conditions.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const condition = item as Record<string, unknown>;
    if (typeof condition.fieldId !== "string" || !condition.fieldId) return [];
    return [{
      fieldId: condition.fieldId,
      operator: typeof condition.operator === "string" ? condition.operator : "contains",
      value: condition.value === null || condition.value === undefined ? "" : String(condition.value)
    }];
  });
  if (normalized.length) return normalized;
  if (typeof filter.fieldId !== "string" || !filter.fieldId) return [];
  return [{
    fieldId: filter.fieldId,
    operator: typeof filter.operator === "string" ? filter.operator : "contains",
    value: filter.value === null || filter.value === undefined ? "" : String(filter.value)
  }];
}

function viewSortRules(sort: unknown[]): ViewSortRule[] {
  return sort.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const rule = item as Record<string, unknown>;
    if (typeof rule.fieldId !== "string" || !rule.fieldId) return [];
    return [{ fieldId: rule.fieldId, direction: rule.direction === "desc" ? "desc" as const : "asc" as const }];
  });
}

function viewGroupRules(group: Record<string, unknown>): ViewGroupRule[] {
  const rules = Array.isArray(group.rules) ? group.rules : [];
  const normalized = rules.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const rule = item as Record<string, unknown>;
    return typeof rule.fieldId === "string" && rule.fieldId ? [{ fieldId: rule.fieldId }] : [];
  });
  if (normalized.length) return normalized;
  return typeof group.fieldId === "string" && group.fieldId ? [{ fieldId: group.fieldId }] : [];
}

function matchesFilter(value: unknown, condition: ViewFilterCondition) {
  const actual = stringifyValue(value);
  const left = actual.toLocaleLowerCase("zh-CN");
  const right = condition.value.toLocaleLowerCase("zh-CN");
  if (condition.operator === "is_empty") return !actual.trim();
  if (condition.operator === "is_not_empty") return Boolean(actual.trim());
  if (condition.operator === "equals") return left === right;
  if (condition.operator === "not_equals") return left !== right;
  if (condition.operator === "not_contains") return !left.includes(right);
  if (condition.operator === "greater" || condition.operator === "less") {
    const actualNumber = Number(actual);
    const targetNumber = Number(condition.value);
    if (!Number.isFinite(actualNumber) || !Number.isFinite(targetNumber)) return false;
    return condition.operator === "greater" ? actualNumber > targetNumber : actualNumber < targetNumber;
  }
  if (condition.operator === "after" || condition.operator === "before") {
    const actualDate = new Date(actual).getTime();
    const targetDate = new Date(condition.value).getTime();
    if (!Number.isFinite(actualDate) || !Number.isFinite(targetDate)) return false;
    return condition.operator === "after" ? actualDate > targetDate : actualDate < targetDate;
  }
  return left.includes(right);
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function knowledgeRequest<T>(path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiRoot}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(typeof init?.body === "string" ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json().catch(() => null)) as
    | ({ message?: string; error?: { message?: string } } & T)
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error?.message || payload?.message || "知识库请求失败，请稍后重试。");
  }
  return payload;
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <article className={styles.metricCard}>
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <p>{value}</p>
    </article>
  );
}

function EmptyState({ action, description, title }: { action?: ReactNode; description: string; title: string }) {
  return (
    <div className={styles.emptyState}>
      <div>
        <div className={styles.emptyIcon}>
          <Sparkles />
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? <div className={styles.emptyAction}>{action}</div> : null}
      </div>
    </div>
  );
}

export function KnowledgeWorkspace() {
  const [dashboard, setDashboard] = useState<Dashboard>({
    pageCount: 0,
    recentPages: [],
    recentTables: [],
    recordCount: 0,
    spaceCount: 0,
    tableCount: 0
  });
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([]);
  const [accessRole, setAccessRole] = useState<KnowledgeAccessRole>("viewer");
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [tables, setTables] = useState<KnowledgeTable[]>([]);
  const [fields, setFields] = useState<KnowledgeField[]>([]);
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordsLoadingMore, setRecordsLoadingMore] = useState(false);
  const [views, setViews] = useState<KnowledgeView[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedViewId, setSelectedViewId] = useState("");
  const [detailRecordId, setDetailRecordId] = useState("");
  const [mode, setMode] = useState<WorkspaceMode>("home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recordSearch, setRecordSearch] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  const [sortRules, setSortRules] = useState<ViewSortRule[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("grid");
  const [baseSection, setBaseSection] = useState<BaseSection>("table");
  const [pageTitle, setPageTitle] = useState("");
  const [documentBlocks, setDocumentBlocks] = useState<DocumentBlock[]>([newBlock()]);
  const [lastSavedDocument, setLastSavedDocument] = useState("");
  const [documentStatus, setDocumentStatus] = useState<"conflict" | "dirty" | "saved" | "saving">("saved");
  const [slashBlockId, setSlashBlockId] = useState("");
  const [selectedTextBlockId, setSelectedTextBlockId] = useState("");
  const [expandedPageIds, setExpandedPageIds] = useState<string[]>([]);
  const [pageActionId, setPageActionId] = useState("");
  const [fieldActionId, setFieldActionId] = useState("");
  const [panel, setPanel] = useState<WorkspacePanel | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [members, setMembers] = useState<KnowledgeSpaceMember[]>([]);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberAccount, setMemberAccount] = useState("");
  const [memberRole, setMemberRole] = useState<Exclude<KnowledgeMemberRole, "owner">>("viewer");
  const [comments, setComments] = useState<KnowledgeComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [versions, setVersions] = useState<KnowledgePageVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<KnowledgePageVersion | null>(null);
  const [automations, setAutomations] = useState<KnowledgeAutomationRule[]>([]);
  const [automationRuns, setAutomationRuns] = useState<KnowledgeAutomationRun[]>([]);
  const [selectedAutomationId, setSelectedAutomationId] = useState("");
  const [automationName, setAutomationName] = useState("");
  const [automationTrigger, setAutomationTrigger] = useState<AutomationTrigger>("manual");
  const [recordTab, setRecordTab] = useState<RecordDrawerTab>("fields");
  const [recordActivities, setRecordActivities] = useState<KnowledgeRecordActivity[]>([]);
  const [recordAttachments, setRecordAttachments] = useState<KnowledgeAttachment[]>([]);
  const [trashItems, setTrashItems] = useState<KnowledgeTrashItem[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [filterConjunction, setFilterConjunction] = useState<"and" | "or">("and");
  const [filterConditions, setFilterConditions] = useState<ViewFilterCondition[]>([]);
  const [groupRules, setGroupRules] = useState<ViewGroupRule[]>([]);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createFieldType, setCreateFieldType] = useState<FieldType>("text");
  const [createFieldOptions, setCreateFieldOptions] = useState("");
  const [createFieldFormula, setCreateFieldFormula] = useState("");
  const [createFieldRequired, setCreateFieldRequired] = useState(false);
  const [createFieldRelationTableId, setCreateFieldRelationTableId] = useState("");
  const [createViewType, setCreateViewType] = useState<ViewType>("grid");
  const [editingFieldId, setEditingFieldId] = useState("");
  const [viewActionId, setViewActionId] = useState("");
  const [calendarScale, setCalendarScale] = useState<"day" | "month" | "week">("month");
  const [calendarAnchor, setCalendarAnchor] = useState(() => dateKey(new Date()));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const loadedPageId = useRef("");
  const selectedViewIdRef = useRef("");
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const flushDocumentRef = useRef<() => Promise<boolean>>(async () => true);
  const documentContextRef = useRef<{
    blocks: DocumentBlock[];
    lastSavedDocument: string;
    page?: KnowledgePage;
    spaceId: string;
    title: string;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const selectedSpace = spaces.find((space) => space.id === selectedSpaceId);
  const selectedPage = pages.find((page) => page.id === selectedPageId);
  const selectedTable = tables.find((table) => table.id === selectedTableId);
  const selectedView = views.find((view) => view.id === selectedViewId);
  const detailRecord = records.find((record) => record.id === detailRecordId);
  const canWrite = accessRole === "admin" || accessRole === "owner" || accessRole === "editor";
  const canComment = canWrite || accessRole === "commenter";
  const canManage = accessRole === "admin" || accessRole === "owner";
  const documentSnapshot = useMemo(
    () => JSON.stringify({ blocks: documentBlocks, title: pageTitle }),
    [documentBlocks, pageTitle]
  );

  useEffect(() => {
    selectedViewIdRef.current = selectedViewId;
  }, [selectedViewId]);

  useEffect(() => {
    documentContextRef.current = {
      blocks: documentBlocks,
      lastSavedDocument,
      page: selectedPage,
      spaceId: selectedSpaceId,
      title: pageTitle
    };
  }, [documentBlocks, lastSavedDocument, pageTitle, selectedPage, selectedSpaceId]);

  const applyViewState = useCallback((view: KnowledgeView) => {
    selectedViewIdRef.current = view.id;
    setSelectedViewId(view.id);
    setDisplayMode(view.viewType);
    setSortRules(viewSortRules(view.sort));
    setFilterConditions(viewFilterConditions(view.filter));
    setFilterConjunction(view.filter.conjunction === "or" ? "or" : "and");
    setGroupRules(viewGroupRules(view.group));
  }, []);

  const loadWorkspace = useCallback(async (spaceId?: string, tableId?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (spaceId) query.set("spaceId", spaceId);
      if (spaceId && tableId) query.set("tableId", tableId);
      const response = await knowledgeRequest<BootstrapResponse>(query.size ? `?${query}` : "");
      setDashboard(response.dashboard);
      setSpaces(response.spaces);
      if (spaceId) {
        setAccessRole(response.accessRole ?? "viewer");
        setPages(response.pages ?? []);
        setTables(response.tables ?? []);
      }
      if (tableId) {
        setFields(response.fields ?? []);
        setRecords(response.records ?? []);
        setRecordTotal(response.recordTotal ?? response.records?.length ?? 0);
        setViews(response.views ?? []);
        const preferred =
          response.views?.find((view) => view.id === selectedViewIdRef.current) ??
          response.views?.find((view) => view.isDefault) ??
          response.views?.[0];
        if (preferred) {
          applyViewState(preferred);
        } else {
          selectedViewIdRef.current = "";
          setSelectedViewId("");
          setDisplayMode("grid");
          setSortRules([]);
          setFilterConditions([]);
          setFilterConjunction("and");
          setGroupRules([]);
        }
      }
      return response;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "知识库加载失败。");
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyViewState]);

  useEffect(() => {
    void (async () => {
      const response = await loadWorkspace();
      const hash = new URLSearchParams(window.location.hash.replace(/^#/u, ""));
      const targetSpace =
        response?.spaces.find((space) => space.id === hash.get("space")) ??
        response?.spaces[0];
      if (targetSpace) {
        setSelectedSpaceId(targetSpace.id);
        const spaceResponse = await loadWorkspace(
          targetSpace.id,
          hash.get("table") || undefined
        );
        const pageId = hash.get("page") ?? "";
        const tableId = hash.get("table") ?? "";
        if (pageId && spaceResponse?.pages?.some((page) => page.id === pageId)) {
          loadedPageId.current = "";
          setSelectedPageId(pageId);
          setMode("page");
        } else if (tableId && spaceResponse?.table?.id === tableId) {
          setSelectedTableId(tableId);
          setMode("table");
          const viewId = hash.get("view");
          const targetView = spaceResponse.views?.find((view) => view.id === viewId);
          if (targetView) {
            applyViewState(targetView);
          }
          const recordId = hash.get("record");
          if (recordId && spaceResponse.records?.some((record) => record.id === recordId)) {
            setDetailRecordId(recordId);
          }
        }
      }
    })();
  }, [applyViewState, loadWorkspace]);

  useEffect(() => {
    if (!selectedSpaceId) return;
    const hash = new URLSearchParams();
    hash.set("space", selectedSpaceId);
    if (mode === "page" && selectedPageId) hash.set("page", selectedPageId);
    if (mode === "table" && selectedTableId) {
      hash.set("table", selectedTableId);
      if (selectedViewId) hash.set("view", selectedViewId);
      if (detailRecordId) hash.set("record", detailRecordId);
    }
    window.history.replaceState(null, "", `${window.location.pathname}#${hash.toString()}`);
  }, [detailRecordId, mode, selectedPageId, selectedSpaceId, selectedTableId, selectedViewId]);

  useEffect(() => {
    if (!selectedPage) return;
    if (loadedPageId.current === selectedPage.id) return;
    const timer = window.setTimeout(() => {
      const blocks = contentToBlocks(selectedPage.content);
      const snapshot = JSON.stringify({ blocks, title: selectedPage.title });
      loadedPageId.current = selectedPage.id;
      setPageTitle(selectedPage.title);
      setDocumentBlocks(blocks);
      setLastSavedDocument(snapshot);
      setDocumentStatus("saved");
      setSlashBlockId("");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedPage]);

  const openSpace = useCallback(
    async (spaceId: string) => {
      if (!(await flushDocumentRef.current())) return false;
      setAccessRole("viewer");
      setAutomations([]);
      setAutomationRuns([]);
      setSelectedAutomationId("");
      setTrashItems([]);
      setSelectedSpaceId(spaceId);
      setSelectedPageId("");
      setSelectedTableId("");
      setDetailRecordId("");
      setMode("home");
      await loadWorkspace(spaceId);
      return true;
    },
    [loadWorkspace]
  );

  const openTable = useCallback(
    async (tableId: string) => {
      if (!selectedSpaceId) return false;
      if (!(await flushDocumentRef.current())) return false;
      setAutomations([]);
      setAutomationRuns([]);
      setSelectedAutomationId("");
      setSelectedTableId(tableId);
      setBaseSection("table");
      setSelectedPageId("");
      setDetailRecordId("");
      setMode("table");
      await loadWorkspace(selectedSpaceId, tableId);
      try {
        const response = await knowledgeRequest<{ automations: KnowledgeAutomationRule[] }>(
          `/spaces/${selectedSpaceId}/tables/${tableId}/automations`
        );
        setAutomations(response.automations);
      } catch {
        setAutomations([]);
      }
      return true;
    },
    [loadWorkspace, selectedSpaceId]
  );

  const activateView = useCallback((view: KnowledgeView) => {
    setBaseSection("table");
    applyViewState(view);
  }, [applyViewState]);

  const updateSelectedView = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!canWrite || !selectedView || !selectedSpaceId || !selectedTableId) return;
      setSaving(true);
      setError("");
      try {
        const response = await knowledgeRequest<{ view: KnowledgeView }>(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/views/${selectedView.id}`,
          {
            body: JSON.stringify({ ...patch, revision: selectedView.revision }),
            method: "PATCH"
          }
        );
        setViews((current) =>
          current.map((view) => (view.id === response.view.id ? response.view : view))
        );
        if (response.view.id === selectedViewIdRef.current) applyViewState(response.view);
        setMessage("视图设置已同步");
      } catch (viewError) {
        setError(viewError instanceof Error ? viewError.message : "视图设置保存失败。");
        await loadWorkspace(selectedSpaceId, selectedTableId);
      } finally {
        setSaving(false);
      }
    },
    [applyViewState, canWrite, loadWorkspace, selectedSpaceId, selectedTableId, selectedView]
  );

  const renameView = useCallback(async (view: KnowledgeView) => {
    if (!canWrite || !selectedSpaceId || !selectedTableId) return;
    const name = window.prompt("视图名称", view.name)?.trim();
    if (!name || name === view.name) return;
    try {
      const response = await knowledgeRequest<{ view: KnowledgeView }>(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/views/${view.id}`,
        { body: JSON.stringify({ name, revision: view.revision }), method: "PATCH" }
      );
      setViews((current) => current.map((item) => item.id === response.view.id ? response.view : item));
      setViewActionId("");
      setMessage("视图已重命名");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "视图重命名失败。");
    }
  }, [canWrite, selectedSpaceId, selectedTableId]);

  const duplicateView = useCallback(async (view: KnowledgeView) => {
    if (!canWrite || !selectedSpaceId || !selectedTableId) return;
    try {
      const response = await knowledgeRequest<{ view: KnowledgeView }>(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/views`,
        {
          body: JSON.stringify({
            filter: view.filter,
            frozenFieldCount: view.frozenFieldCount,
            group: view.group,
            isDefault: false,
            name: `${view.name} 副本`,
            rowHeight: view.rowHeight,
            sort: view.sort,
            viewType: view.viewType,
            visibleFieldIds: view.visibleFieldIds
          }),
          method: "POST"
        }
      );
      setViews((current) => [...current, response.view]);
      activateView(response.view);
      setViewActionId("");
      setMessage("视图副本已创建");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "复制视图失败。");
    }
  }, [activateView, canWrite, selectedSpaceId, selectedTableId]);

  const makeDefaultView = useCallback(async (view: KnowledgeView) => {
    if (!canWrite || !selectedSpaceId || !selectedTableId || view.isDefault) return;
    try {
      const response = await knowledgeRequest<{ view: KnowledgeView }>(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/views/${view.id}`,
        { body: JSON.stringify({ isDefault: true, revision: view.revision }), method: "PATCH" }
      );
      setViews((current) => current.map((item) => ({
        ...item,
        isDefault: item.id === response.view.id
      })));
      setViewActionId("");
      setMessage("已设为默认视图");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "设置默认视图失败。");
    }
  }, [canWrite, selectedSpaceId, selectedTableId]);

  const removeView = useCallback(async (view: KnowledgeView) => {
    if (!canWrite || !selectedSpaceId || !selectedTableId) return;
    if (views.length <= 1) {
      setError("至少需要保留一个视图。");
      return;
    }
    if (!window.confirm(`删除视图“${view.name}”？数据记录不会被删除。`)) return;
    try {
      await knowledgeRequest(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/views/${view.id}?revision=${view.revision}`,
        { method: "DELETE" }
      );
      const remaining = views.filter((item) => item.id !== view.id);
      setViews(remaining);
      if (selectedViewId === view.id) activateView(remaining.find((item) => item.isDefault) ?? remaining[0]);
      setViewActionId("");
      setMessage("视图已删除，数据记录保持不变");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "删除视图失败。");
    }
  }, [activateView, canWrite, selectedSpaceId, selectedTableId, selectedViewId, views]);

  const openPage = useCallback(async (pageId: string) => {
    if (!(await flushDocumentRef.current())) return false;
    loadedPageId.current = "";
    setSelectedPageId(pageId);
    setSelectedTableId("");
    setDetailRecordId("");
    setAutomations([]);
    setAutomationRuns([]);
    setSelectedAutomationId("");
    setMode("page");
    return true;
  }, []);

  const openHome = useCallback(async () => {
    if (!(await flushDocumentRef.current())) return false;
    setMode("home");
    setSelectedPageId("");
    setSelectedTableId("");
    setDetailRecordId("");
    setAutomations([]);
    setAutomationRuns([]);
    setSelectedAutomationId("");
    return true;
  }, []);

  const refreshCurrent = useCallback(async () => {
    if (!(await flushDocumentRef.current())) return;
    if (mode === "page") loadedPageId.current = "";
    await loadWorkspace(selectedSpaceId || undefined, selectedTableId || undefined);
  }, [loadWorkspace, mode, selectedSpaceId, selectedTableId]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      const params = new URLSearchParams({ limit: "50", q: query });
      if (selectedSpaceId) params.set("spaceId", selectedSpaceId);
      void knowledgeRequest<{ results: KnowledgeSearchResult[] }>(
        `/search?${params}`,
        { signal: controller.signal }
      )
        .then((response) => setSearchResults(response.results))
        .catch((searchError) => {
          if ((searchError as Error).name !== "AbortError") {
            setError(searchError instanceof Error ? searchError.message : "知识库搜索失败。");
          }
        })
        .finally(() => setSearchLoading(false));
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search, selectedSpaceId]);

  useEffect(() => {
    const focusKnowledgeSearch = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setSidebarCollapsed(false);
      window.requestAnimationFrame(() => {
        const input = document.getElementById("knowledge-search") as HTMLInputElement | null;
        input?.focus();
        input?.select();
      });
    };
    window.addEventListener("keydown", focusKnowledgeSearch);
    return () => window.removeEventListener("keydown", focusKnowledgeSearch);
  }, []);

  const openSearchResult = useCallback(
    async (result: KnowledgeSearchResult) => {
      setSearchResults([]);
      setSearch("");
      if (result.kind === "page") {
        if (result.spaceId !== selectedSpaceId && !(await openSpace(result.spaceId))) return;
        await openPage(result.id);
        return;
      }
      const tableId = result.kind === "table" ? result.id : result.tableId;
      if (!tableId) return;
      if (result.spaceId !== selectedSpaceId && !(await openSpace(result.spaceId))) return;
      if (!(await openTable(tableId))) return;
      if (result.kind === "record") {
        setDetailRecordId(result.id);
        setRecordTab("fields");
      }
    },
    [openPage, openSpace, openTable, selectedSpaceId]
  );

  const createResource = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!canWrite || !createKind || !createTitle.trim()) return;
      setSaving(true);
      setError("");
      try {
        let path = "/spaces";
        let body: Record<string, unknown> = {
          description: createDescription,
          title: createTitle.trim()
        };
        if (createKind === "page") {
          path = `/spaces/${selectedSpaceId}/pages`;
          body = {
            content: pageContent([newBlock("paragraph", "开始记录新的知识内容。")]),
            icon: "file-text",
            pageType: "document",
            parentId: selectedPageId || null,
            title: createTitle.trim()
          };
        } else if (createKind === "table") {
          path = `/spaces/${selectedSpaceId}/tables`;
          body = { description: createDescription, icon: "table-2", title: createTitle.trim() };
        } else if (createKind === "field") {
          path = `/spaces/${selectedSpaceId}/tables/${selectedTableId}/fields`;
          const options = createFieldOptions
            .split(/[、,，\n]/u)
            .map((item) => item.trim())
            .filter(Boolean)
            .map((label, index) => ({ color: ["cyan", "blue", "violet", "green", "orange"][index % 5], label }));
          const config: Record<string, unknown> = { required: createFieldRequired };
          if (["select", "multi_select"].includes(createFieldType)) config.options = options;
          if (createFieldType === "formula") config.formula = createFieldFormula.trim();
          if (["relation", "lookup"].includes(createFieldType)) {
            config.relationTableId = createFieldRelationTableId || selectedTableId;
          }
          if (editingFieldId) {
            const currentField = fields.find((field) => field.id === editingFieldId);
            if (!currentField) throw new Error("要编辑的字段不存在，请刷新后重试。");
            const response = await knowledgeRequest<{ field: KnowledgeField }>(
              `/spaces/${selectedSpaceId}/tables/${selectedTableId}/fields/${editingFieldId}`,
              {
                body: JSON.stringify({
                  config: { ...currentField.config, ...config },
                  fieldType: createFieldType,
                  name: createTitle.trim(),
                  revision: currentField.revision
                }),
                method: "PATCH"
              }
            );
            setFields((current) => current.map((field) => field.id === response.field.id ? response.field : field));
            setCreateKind(null);
            setEditingFieldId("");
            setCreateTitle("");
            setCreateFieldOptions("");
            setCreateFieldFormula("");
            setCreateFieldRequired(false);
            setCreateFieldRelationTableId("");
            setMessage("字段配置已保存");
            return;
          }
          body = {
            config,
            fieldType: createFieldType,
            name: createTitle.trim(),
            sortOrder: fields.length * 10
          };
        } else if (createKind === "view") {
          path = `/spaces/${selectedSpaceId}/tables/${selectedTableId}/views`;
          body = {
            filter: {},
            frozenFieldCount: 1,
            group: {},
            isDefault: false,
            name: createTitle.trim(),
            rowHeight: "medium",
            sort: [],
            viewType: createViewType,
            visibleFieldIds: fields.map((field) => field.id)
          };
        }
        const response = await knowledgeRequest<Record<string, unknown>>(path, {
          body: JSON.stringify(body),
          method: "POST"
        });
        setCreateKind(null);
        setCreateTitle("");
        setCreateDescription("");
        setCreateFieldOptions("");
        setCreateFieldFormula("");
        setCreateFieldRequired(false);
        setCreateFieldRelationTableId("");
        setEditingFieldId("");
        setMessage("已创建并同步到云端");
        if (createKind === "space") {
          const space = response.space as KnowledgeSpace | undefined;
          if (space) await openSpace(space.id);
        } else if (createKind === "page") {
          const page = response.page as KnowledgePage | undefined;
          await loadWorkspace(selectedSpaceId);
          if (page) await openPage(page.id);
        } else if (createKind === "table") {
          const table = response.table as KnowledgeTable | undefined;
          await loadWorkspace(selectedSpaceId);
          if (table) await openTable(table.id);
        } else if (createKind === "view") {
          const view = response.view as KnowledgeView | undefined;
          await loadWorkspace(selectedSpaceId, selectedTableId);
          if (view) activateView(view);
        } else {
          await loadWorkspace(selectedSpaceId, selectedTableId);
        }
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "创建失败。");
      } finally {
        setSaving(false);
      }
    },
    [
      createDescription,
      createFieldFormula,
      createFieldOptions,
      createFieldRelationTableId,
      createFieldRequired,
      createFieldType,
      createKind,
      createTitle,
      createViewType,
      activateView,
      canWrite,
      fields,
      editingFieldId,
      loadWorkspace,
      openPage,
      openSpace,
      openTable,
      selectedPageId,
      selectedSpaceId,
      selectedTableId
    ]
  );

  const savePage = useCallback(async (): Promise<boolean> => {
    if (saveInFlightRef.current) {
      const completed = await saveInFlightRef.current;
      if (!completed) return false;
    }

    const context = documentContextRef.current;
    if (!context?.page || !context.spaceId) return true;
    const snapshot = JSON.stringify({ blocks: context.blocks, title: context.title });
    if (snapshot === context.lastSavedDocument) return true;
    if (!context.title.trim()) {
      setDocumentStatus("dirty");
      setError("文档标题不能为空，请填写后再切换。");
      return false;
    }

    const pageId = context.page.id;
    const task = (async () => {
      setSaving(true);
      setDocumentStatus("saving");
      setError("");
      try {
        const response = await knowledgeRequest<{ page: KnowledgePage }>(
          `/spaces/${context.spaceId}/pages/${pageId}`,
          {
            body: JSON.stringify({
              content: pageContent(context.blocks),
              revision: context.page?.revision,
              title: context.title
            }),
            method: "PATCH"
          }
        );
        setPages((current) =>
          current.map((page) => (page.id === response.page.id ? response.page : page))
        );
        const latest = documentContextRef.current;
        if (latest?.page?.id === pageId) {
          const latestSnapshot = JSON.stringify({ blocks: latest.blocks, title: latest.title });
          documentContextRef.current = {
            ...latest,
            lastSavedDocument: snapshot,
            page: response.page
          };
          setLastSavedDocument(snapshot);
          setDocumentStatus(latestSnapshot === snapshot ? "saved" : "dirty");
        }
        return true;
      } catch (saveError) {
        const text = saveError instanceof Error ? saveError.message : "文档保存失败。";
        if (documentContextRef.current?.page?.id === pageId) {
          setDocumentStatus(/冲突|revision|版本/u.test(text) ? "conflict" : "dirty");
          setError(text);
        }
        return false;
      } finally {
        setSaving(false);
      }
    })();

    saveInFlightRef.current = task;
    try {
      return await task;
    } finally {
      if (saveInFlightRef.current === task) saveInFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    flushDocumentRef.current = async () => {
      const context = documentContextRef.current;
      if (!context?.page) return true;
      const snapshot = JSON.stringify({ blocks: context.blocks, title: context.title });
      if (snapshot === context.lastSavedDocument) return true;
      return savePage();
    };
  }, [savePage]);

  useEffect(() => {
    if (!canWrite || mode !== "page" || !selectedPage || documentSnapshot === lastSavedDocument) return;
    if (!pageTitle.trim() || documentStatus === "saving" || documentStatus === "conflict") return;
    const statusTimer = window.setTimeout(() => setDocumentStatus("dirty"), 0);
    const saveTimer = window.setTimeout(() => void savePage(), 900);
    return () => {
      window.clearTimeout(statusTimer);
      window.clearTimeout(saveTimer);
    };
  }, [canWrite, documentSnapshot, documentStatus, lastSavedDocument, mode, pageTitle, savePage, selectedPage]);

  useEffect(() => {
    const hasUnsavedDocument =
      mode === "page" && Boolean(selectedPage) && documentSnapshot !== lastSavedDocument;
    if (!hasUnsavedDocument) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [documentSnapshot, lastSavedDocument, mode, selectedPage]);

  const deleteSelected = useCallback(async () => {
    if (!canWrite || !selectedSpaceId) return;
    const resource = mode === "page" ? selectedPage : mode === "table" ? selectedTable : null;
    if (!resource || !window.confirm(`确定将“${resource.title}”移入回收站吗？之后可以恢复。`)) return;
    setSaving(true);
    try {
      const path =
        mode === "page"
          ? `/spaces/${selectedSpaceId}/pages/${resource.id}?revision=${resource.revision}`
          : `/spaces/${selectedSpaceId}/tables/${resource.id}?revision=${resource.revision}`;
      await knowledgeRequest(path, { method: "DELETE" });
      setMode("home");
      setSelectedPageId("");
      setSelectedTableId("");
      setAutomations([]);
      setAutomationRuns([]);
      setSelectedAutomationId("");
      await loadWorkspace(selectedSpaceId);
      setMessage("已移入回收站，可在回收站恢复");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败。");
    } finally {
      setSaving(false);
    }
  }, [canWrite, loadWorkspace, mode, selectedPage, selectedSpaceId, selectedTable]);

  const addRecord = useCallback(async () => {
    if (!canWrite || !selectedSpaceId || !selectedTableId) return;
    const readonlyTypes: FieldType[] = [
      "attachment",
      "autonumber",
      "created_time",
      "formula",
      "lookup",
      "updated_time"
    ];
    const values = Object.fromEntries(
      fields.filter((field) => !readonlyTypes.includes(field.fieldType)).map((field) => [
        field.id,
        field.fieldType === "checkbox"
          ? false
          : field.fieldType === "multi_select"
            ? []
            : field.config.required === true
              ? "未命名记录"
              : ""
      ])
    );
    setSaving(true);
    try {
      await knowledgeRequest(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records`,
        { body: JSON.stringify({ sortOrder: recordTotal * 10, values }), method: "POST" }
      );
      await loadWorkspace(selectedSpaceId, selectedTableId);
      setMessage("已新增记录");
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "新增记录失败。");
    } finally {
      setSaving(false);
    }
  }, [canWrite, fields, loadWorkspace, recordTotal, selectedSpaceId, selectedTableId]);

  const loadMoreRecords = useCallback(async () => {
    if (!selectedSpaceId || !selectedTableId || recordsLoadingMore || records.length >= recordTotal) return;
    setRecordsLoadingMore(true);
    try {
      const response = await knowledgeRequest<{
        hasMore: boolean;
        records: KnowledgeRecord[];
        total: number;
      }>(`/spaces/${selectedSpaceId}/tables/${selectedTableId}/records?limit=500&offset=${records.length}`);
      setRecords((current) => {
        const known = new Set(current.map((record) => record.id));
        return [...current, ...response.records.filter((record) => !known.has(record.id))];
      });
      setRecordTotal(response.total);
    } catch (recordsError) {
      setError(recordsError instanceof Error ? recordsError.message : "更多记录加载失败。");
    } finally {
      setRecordsLoadingMore(false);
    }
  }, [recordTotal, records.length, recordsLoadingMore, selectedSpaceId, selectedTableId]);

  const updateRecordValue = useCallback(
    async (record: KnowledgeRecord, field: KnowledgeField, value: string | boolean) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId) return;
      try {
        const response = await knowledgeRequest<{ record: KnowledgeRecord }>(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records/${record.id}`,
          {
            body: JSON.stringify({
              revision: record.revision,
              values: { ...record.values, [field.id]: parseInputValue(field, value) }
            }),
            method: "PATCH"
          }
        );
        setRecords((current) =>
          current.map((item) => (item.id === response.record.id ? response.record : item))
        );
        setMessage("记录已同步");
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "记录更新失败。");
        await loadWorkspace(selectedSpaceId, selectedTableId);
      }
    },
    [canWrite, loadWorkspace, selectedSpaceId, selectedTableId]
  );

  const deleteRecord = useCallback(
    async (record: KnowledgeRecord) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId || !window.confirm("确定删除这条记录吗？")) return;
      try {
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records/${record.id}?revision=${record.revision}`,
          { method: "DELETE" }
        );
        setDetailRecordId("");
        await loadWorkspace(selectedSpaceId, selectedTableId);
      } catch (recordError) {
        setError(recordError instanceof Error ? recordError.message : "记录删除失败。");
      }
    },
    [canWrite, loadWorkspace, selectedSpaceId, selectedTableId]
  );

  const focusDocumentBlock = useCallback((blockId: string, atEnd = false) => {
    window.requestAnimationFrame(() => {
      const input = document.getElementById(`knowledge-block-${blockId}`) as HTMLTextAreaElement | null;
      if (!input) return;
      input.focus();
      const position = atEnd ? input.value.length : 0;
      input.setSelectionRange(position, position);
    });
  }, []);

  const updateDocumentBlock = useCallback(
    (blockId: string, patch: Partial<DocumentBlock>) => {
      setDocumentBlocks((current) =>
        current.map((block) => (block.id === blockId ? { ...block, ...patch } : block))
      );
    },
    []
  );

  const insertDocumentBlock = useCallback(
    (afterId: string, type: BlockType = "paragraph", text = "") => {
      const block = newBlock(type, text);
      setDocumentBlocks((current) => {
        const index = current.findIndex((item) => item.id === afterId);
        const next = [...current];
        next.splice(index < 0 ? current.length : index + 1, 0, block);
        return next;
      });
      setSlashBlockId("");
      focusDocumentBlock(block.id);
    },
    [focusDocumentBlock]
  );

  const chooseBlockType = useCallback(
    (blockId: string, type: BlockType) => {
      if (type === "divider") {
        updateDocumentBlock(blockId, { text: "", type });
        insertDocumentBlock(blockId);
      } else {
        updateDocumentBlock(blockId, { text: "", type });
        focusDocumentBlock(blockId);
      }
      setSlashBlockId("");
    },
    [focusDocumentBlock, insertDocumentBlock, updateDocumentBlock]
  );

  const formatSelectedText = useCallback(
    (blockId: string, prefix: string, suffix = prefix) => {
      const input = document.getElementById(`knowledge-block-${blockId}`) as HTMLTextAreaElement | null;
      const block = documentBlocks.find((item) => item.id === blockId);
      if (!input || !block || input.selectionStart === input.selectionEnd) return;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const next = `${block.text.slice(0, start)}${prefix}${block.text.slice(start, end)}${suffix}${block.text.slice(end)}`;
      updateDocumentBlock(blockId, { text: next });
      window.requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(start + prefix.length, end + prefix.length);
      });
    },
    [documentBlocks, updateDocumentBlock]
  );

  const handleBlockKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>, block: DocumentBlock) => {
      const input = event.currentTarget;
      const blockIndex = documentBlocks.findIndex((item) => item.id === block.id);
      if (event.key === "/" && !block.text) {
        window.setTimeout(() => setSlashBlockId(block.id), 0);
        return;
      }
      if (event.key === "Escape") {
        setSlashBlockId("");
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const before = block.text.slice(0, start);
        const after = block.text.slice(end);
        updateDocumentBlock(block.id, { text: before });
        insertDocumentBlock(block.id, "paragraph", after);
        return;
      }
      if (event.key === "Backspace" && !block.text && documentBlocks.length > 1) {
        event.preventDefault();
        const previous = documentBlocks[Math.max(0, blockIndex - 1)];
        setDocumentBlocks((current) => current.filter((item) => item.id !== block.id));
        if (previous) focusDocumentBlock(previous.id, true);
      }
    },
    [documentBlocks, focusDocumentBlock, insertDocumentBlock, updateDocumentBlock]
  );

  const movePage = useCallback(
    async (page: KnowledgePage, direction: -1 | 1) => {
      if (!canWrite || !selectedSpaceId) return;
      const siblings = pages
        .filter((item) => (item.parentId ?? "") === (page.parentId ?? ""))
        .sort((left, right) => left.sortOrder - right.sortOrder);
      const index = siblings.findIndex((item) => item.id === page.id);
      const target = siblings[index + direction];
      if (!target) return;
      try {
        const response = await knowledgeRequest<{ pages: KnowledgePage[] }>(
          `/spaces/${selectedSpaceId}/pages/reorder`,
          {
            body: JSON.stringify({
              items: [
                {
                  id: page.id,
                  parentId: page.parentId ?? null,
                  revision: page.revision,
                  sortOrder: target.sortOrder
                },
                {
                  id: target.id,
                  parentId: target.parentId ?? null,
                  revision: target.revision,
                  sortOrder: page.sortOrder
                }
              ]
            }),
            method: "PATCH"
          }
        );
        setPages(response.pages);
        setPageActionId("");
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : "页面排序失败。");
      }
    },
    [canWrite, pages, selectedSpaceId]
  );

  const openFieldEditor = useCallback((field: KnowledgeField) => {
    if (!canWrite) return;
    setFieldActionId("");
    setEditingFieldId(field.id);
    setCreateTitle(field.name);
    setCreateFieldType(field.fieldType);
    setCreateFieldOptions(fieldOptions(field).join("、"));
    setCreateFieldFormula(typeof field.config.formula === "string" ? field.config.formula : "");
    setCreateFieldRequired(field.config.required === true);
    setCreateFieldRelationTableId(
      typeof field.config.relationTableId === "string" ? field.config.relationTableId : selectedTableId
    );
    setCreateKind("field");
  }, [canWrite, selectedTableId]);

  const removeField = useCallback(
    async (field: KnowledgeField) => {
      if (field.config.primary === true) {
        setError("主字段是每条记录的标题标识，不能删除。");
        return;
      }
      if (
        !canWrite ||
        !selectedSpaceId ||
        !selectedTableId ||
        !window.confirm(`删除字段“${field.name}”及该列数据？此操作不可撤销。`)
      ) return;
      try {
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/fields/${field.id}?revision=${field.revision}`,
          { method: "DELETE" }
        );
        setFieldActionId("");
        await loadWorkspace(selectedSpaceId, selectedTableId);
      } catch (fieldError) {
        setError(fieldError instanceof Error ? fieldError.message : "字段删除失败。");
      }
    },
    [canWrite, loadWorkspace, selectedSpaceId, selectedTableId]
  );

  const exportRecords = useCallback(async () => {
    if (!selectedSpaceId || !selectedTableId || !selectedTable) return;
    try {
      const query = selectedViewId ? `?viewId=${encodeURIComponent(selectedViewId)}` : "";
      const response = await fetch(
        `${apiRoot}/spaces/${selectedSpaceId}/tables/${selectedTableId}/export${query}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string }; message?: string }
          | null;
        throw new Error(payload?.error?.message || payload?.message || "CSV 导出失败。");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedTable.title}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("当前视图 CSV 已导出到本机");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "CSV 导出失败。");
    }
  }, [selectedSpaceId, selectedTable, selectedTableId, selectedViewId]);

  const importRecords = useCallback(
    async (file: File) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId) return;
      setSaving(true);
      try {
        const body = new FormData();
        body.set("file", file);
        body.set("createMissingFields", "false");
        const response = await knowledgeRequest<{
          createdFields: KnowledgeField[];
          failed: Array<{ message: string; row: number }>;
          imported: number;
          total: number;
        }>(`/spaces/${selectedSpaceId}/tables/${selectedTableId}/import`, {
          body,
          method: "POST"
        });
        await loadWorkspace(selectedSpaceId, selectedTableId);
        setPanel(null);
        setMessage(
          response.failed.length
            ? `已导入 ${response.imported}/${response.total} 条，${response.failed.length} 条失败（首项：第 ${response.failed[0].row} 行 ${response.failed[0].message}）`
            : `已导入 ${response.imported} 条记录`
        );
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : "CSV 导入失败。");
      } finally {
        setSaving(false);
      }
    },
    [canWrite, loadWorkspace, selectedSpaceId, selectedTableId]
  );

  const loadTrash = useCallback(async () => {
    if (!selectedSpaceId) {
      setTrashItems([]);
      return;
    }
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ items: KnowledgeTrashItem[] }>(
        `/spaces/${selectedSpaceId}/trash`
      );
      setTrashItems(response.items);
    } catch (trashError) {
      setError(trashError instanceof Error ? trashError.message : "回收站加载失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [selectedSpaceId]);

  const restoreTrashItem = useCallback(
    async (item: KnowledgeTrashItem) => {
      if (!canWrite || !selectedSpaceId) return;
      setPanelLoading(true);
      try {
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/trash/${item.resourceType}/${item.id}/restore`,
          { body: JSON.stringify({ revision: item.revision }), method: "POST" }
        );
        await Promise.all([loadWorkspace(selectedSpaceId), loadTrash()]);
        setMessage(`已恢复“${item.title}”`);
      } catch (trashError) {
        setError(trashError instanceof Error ? trashError.message : "恢复失败。");
        await loadTrash();
      } finally {
        setPanelLoading(false);
      }
    },
    [canWrite, loadTrash, loadWorkspace, selectedSpaceId]
  );

  const permanentlyDeleteTrashItem = useCallback(
    async (item: KnowledgeTrashItem) => {
      if (
        !canManage ||
        !selectedSpaceId ||
        !window.confirm(`永久删除“${item.title}”？删除后无法恢复。`)
      ) return;
      setPanelLoading(true);
      try {
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/trash/${item.resourceType}/${item.id}?revision=${item.revision}`,
          { method: "DELETE" }
        );
        await loadTrash();
        setMessage(`已永久删除“${item.title}”`);
      } catch (trashError) {
        setError(trashError instanceof Error ? trashError.message : "永久删除失败。");
        await loadTrash();
      } finally {
        setPanelLoading(false);
      }
    },
    [canManage, loadTrash, selectedSpaceId]
  );

  const loadMembers = useCallback(async () => {
    if (!selectedSpaceId) return;
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ members: KnowledgeSpaceMember[] }>(
        `/spaces/${selectedSpaceId}/members`
      );
      setMembers(response.members);
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "成员加载失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [selectedSpaceId]);

  const createMember = useCallback(async () => {
    if (!canManage || !selectedSpaceId || !memberUserId.trim()) return;
    setPanelLoading(true);
    try {
      await knowledgeRequest(`/spaces/${selectedSpaceId}/members`, {
        body: JSON.stringify({
          account: memberAccount.trim() || undefined,
          role: memberRole,
          userId: memberUserId.trim()
        }),
        method: "POST"
      });
      setMemberUserId("");
      setMemberAccount("");
      await loadMembers();
      setMessage("空间成员已添加");
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : "添加成员失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [canManage, loadMembers, memberAccount, memberRole, memberUserId, selectedSpaceId]);

  const updateMemberRole = useCallback(
    async (member: KnowledgeSpaceMember, role: Exclude<KnowledgeMemberRole, "owner">) => {
      if (!canManage || !selectedSpaceId) return;
      try {
        const response = await knowledgeRequest<{ member: KnowledgeSpaceMember }>(
          `/spaces/${selectedSpaceId}/members/${member.id}`,
          {
            body: JSON.stringify({ revision: member.revision, role }),
            method: "PATCH"
          }
        );
        setMembers((current) =>
          current.map((item) => (item.id === response.member.id ? response.member : item))
        );
      } catch (memberError) {
        setError(memberError instanceof Error ? memberError.message : "成员权限更新失败。");
        await loadMembers();
      }
    },
    [canManage, loadMembers, selectedSpaceId]
  );

  const removeMember = useCallback(
    async (member: KnowledgeSpaceMember) => {
      if (!canManage || !selectedSpaceId || !window.confirm(`移除成员“${member.account || member.userId}”？`)) return;
      try {
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/members/${member.id}?revision=${member.revision}`,
          { method: "DELETE" }
        );
        await loadMembers();
        setMessage("成员已移除");
      } catch (memberError) {
        setError(memberError instanceof Error ? memberError.message : "移除成员失败。");
      }
    },
    [canManage, loadMembers, selectedSpaceId]
  );

  const commentPath = useCallback(
    (commentId?: string) => {
      if (detailRecord && selectedSpaceId && selectedTableId) {
        return `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records/${detailRecord.id}/comments${commentId ? `/${commentId}` : ""}`;
      }
      if (selectedPage && selectedSpaceId) {
        return `/spaces/${selectedSpaceId}/pages/${selectedPage.id}/comments${commentId ? `/${commentId}` : ""}`;
      }
      return "";
    },
    [detailRecord, selectedPage, selectedSpaceId, selectedTableId]
  );

  const loadComments = useCallback(async () => {
    const path = commentPath();
    if (!path) {
      setComments([]);
      return;
    }
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ comments: KnowledgeComment[] }>(path);
      setComments(response.comments.filter((comment) => comment.status !== "deleted"));
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "评论加载失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [commentPath]);

  const publishComment = useCallback(async () => {
    const path = commentPath();
    if (!canComment || !path || !commentDraft.trim()) return;
    setPanelLoading(true);
    try {
      await knowledgeRequest(path, {
        body: JSON.stringify({ body: commentDraft.trim() }),
        method: "POST"
      });
      setCommentDraft("");
      await loadComments();
      setMessage("评论已发布");
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "评论发布失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [canComment, commentDraft, commentPath, loadComments]);

  const setCommentStatus = useCallback(
    async (comment: KnowledgeComment, status: "active" | "resolved") => {
      const path = commentPath(comment.id);
      if (!canWrite || !path) return;
      try {
        const response = await knowledgeRequest<{ comment: KnowledgeComment }>(path, {
          body: JSON.stringify({ revision: comment.revision, status }),
          method: "PATCH"
        });
        setComments((current) =>
          current.map((item) => (item.id === response.comment.id ? response.comment : item))
        );
      } catch (commentError) {
        setError(commentError instanceof Error ? commentError.message : "评论状态更新失败。");
        await loadComments();
      }
    },
    [canWrite, commentPath, loadComments]
  );

  const removeComment = useCallback(
    async (comment: KnowledgeComment) => {
      const path = commentPath(comment.id);
      if (!canWrite || !path || !window.confirm("删除这条评论？")) return;
      try {
        await knowledgeRequest(`${path}?revision=${comment.revision}`, { method: "DELETE" });
        await loadComments();
      } catch (commentError) {
        setError(commentError instanceof Error ? commentError.message : "评论删除失败。");
      }
    },
    [canWrite, commentPath, loadComments]
  );

  const loadVersions = useCallback(async () => {
    if (!selectedSpaceId || !selectedPage) return;
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ versions: KnowledgePageVersion[] }>(
        `/spaces/${selectedSpaceId}/pages/${selectedPage.id}/versions`
      );
      setVersions(response.versions);
      setSelectedVersion(response.versions[0] ?? null);
    } catch (versionError) {
      setError(versionError instanceof Error ? versionError.message : "历史版本加载失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [selectedPage, selectedSpaceId]);

  const inspectVersion = useCallback(
    async (versionId: string) => {
      if (!selectedSpaceId || !selectedPage) return;
      try {
        const response = await knowledgeRequest<{ version: KnowledgePageVersion }>(
          `/spaces/${selectedSpaceId}/pages/${selectedPage.id}/versions/${versionId}`
        );
        setSelectedVersion(response.version);
      } catch (versionError) {
        setError(versionError instanceof Error ? versionError.message : "版本详情加载失败。");
      }
    },
    [selectedPage, selectedSpaceId]
  );

  const restoreVersion = useCallback(async () => {
    if (!canWrite || !selectedSpaceId || !selectedPage || !selectedVersion) return;
    if (!window.confirm(`恢复到版本 ${selectedVersion.versionNumber}？当前内容会先自动留存为历史版本。`)) return;
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ page: KnowledgePage }>(
        `/spaces/${selectedSpaceId}/pages/${selectedPage.id}/versions/${selectedVersion.id}/restore`,
        { body: JSON.stringify({ revision: selectedPage.revision }), method: "POST" }
      );
      loadedPageId.current = "";
      setPages((current) =>
        current.map((page) => (page.id === response.page.id ? response.page : page))
      );
      setPanel(null);
      setMessage(`已恢复到版本 ${selectedVersion.versionNumber}`);
    } catch (versionError) {
      setError(versionError instanceof Error ? versionError.message : "版本恢复失败。");
      await loadVersions();
    } finally {
      setPanelLoading(false);
    }
  }, [canWrite, loadVersions, selectedPage, selectedSpaceId, selectedVersion]);

  const loadAutomationRuns = useCallback(
    async (ruleId: string) => {
      if (!selectedSpaceId || !selectedTableId || !ruleId) {
        setAutomationRuns([]);
        return;
      }
      try {
        const response = await knowledgeRequest<{ runs: KnowledgeAutomationRun[] }>(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/automations/${ruleId}/runs?limit=100`
        );
        setAutomationRuns(response.runs);
      } catch (automationError) {
        setError(automationError instanceof Error ? automationError.message : "运行日志加载失败。");
      }
    },
    [selectedSpaceId, selectedTableId]
  );

  const loadAutomations = useCallback(async () => {
    if (!selectedSpaceId || !selectedTableId) return;
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ automations: KnowledgeAutomationRule[] }>(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/automations`
      );
      setAutomations(response.automations);
      const ruleId = response.automations.some((rule) => rule.id === selectedAutomationId)
        ? selectedAutomationId
        : response.automations[0]?.id ?? "";
      setSelectedAutomationId(ruleId);
      await loadAutomationRuns(ruleId);
    } catch (automationError) {
      setError(automationError instanceof Error ? automationError.message : "自动化加载失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [loadAutomationRuns, selectedAutomationId, selectedSpaceId, selectedTableId]);

  const createAutomation = useCallback(async () => {
    if (!canWrite || !selectedSpaceId || !selectedTableId || !automationName.trim()) return;
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ automation: KnowledgeAutomationRule }>(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/automations`,
        {
          body: JSON.stringify({
            actions: [{ message: "灵穹知识库自动化规则已触发", type: "notification" }],
            conditions: {},
            enabled: true,
            name: automationName.trim(),
            triggerConfig: {},
            triggerType: automationTrigger
          }),
          method: "POST"
        }
      );
      setAutomationName("");
      setSelectedAutomationId(response.automation.id);
      await loadAutomations();
      setMessage("自动化规则已创建");
    } catch (automationError) {
      setError(automationError instanceof Error ? automationError.message : "自动化创建失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [automationName, automationTrigger, canWrite, loadAutomations, selectedSpaceId, selectedTableId]);

  const toggleAutomation = useCallback(
    async (rule: KnowledgeAutomationRule) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId) return;
      try {
        const response = await knowledgeRequest<{ automation: KnowledgeAutomationRule }>(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/automations/${rule.id}`,
          {
            body: JSON.stringify({ enabled: !rule.enabled, revision: rule.revision }),
            method: "PATCH"
          }
        );
        setAutomations((current) =>
          current.map((item) =>
            item.id === response.automation.id ? response.automation : item
          )
        );
      } catch (automationError) {
        setError(automationError instanceof Error ? automationError.message : "自动化状态更新失败。");
        await loadAutomations();
      }
    },
    [canWrite, loadAutomations, selectedSpaceId, selectedTableId]
  );

  const runAutomation = useCallback(
    async (rule: KnowledgeAutomationRule) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId) return;
      setPanelLoading(true);
      try {
        const queued = await knowledgeRequest<{ run: KnowledgeAutomationRun }>(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/automations/${rule.id}/runs`,
          {
            body: JSON.stringify({
              recordId: detailRecord?.id,
              triggerPayload: { source: "knowledge-workspace", timestamp: new Date().toISOString() }
            }),
            method: "POST"
          }
        );
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/automations/${rule.id}/runs/${queued.run.id}/execute`,
          { method: "POST" }
        );
        setSelectedAutomationId(rule.id);
        await loadAutomationRuns(rule.id);
        setMessage("自动化已执行");
      } catch (automationError) {
        setError(automationError instanceof Error ? automationError.message : "自动化运行失败。");
      } finally {
        setPanelLoading(false);
      }
    },
    [canWrite, detailRecord, loadAutomationRuns, selectedSpaceId, selectedTableId]
  );

  const removeAutomation = useCallback(
    async (rule: KnowledgeAutomationRule) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId || !window.confirm(`删除自动化“${rule.name}”？`)) return;
      try {
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/automations/${rule.id}?revision=${rule.revision}`,
          { method: "DELETE" }
        );
        setSelectedAutomationId("");
        await loadAutomations();
      } catch (automationError) {
        setError(automationError instanceof Error ? automationError.message : "自动化删除失败。");
      }
    },
    [canWrite, loadAutomations, selectedSpaceId, selectedTableId]
  );

  const loadRecordActivities = useCallback(async () => {
    if (!selectedSpaceId || !selectedTableId || !detailRecord) return;
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ activities: KnowledgeRecordActivity[] }>(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records/${detailRecord.id}/activity?limit=200`
      );
      setRecordActivities(response.activities);
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : "活动记录加载失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [detailRecord, selectedSpaceId, selectedTableId]);

  const loadAttachments = useCallback(async () => {
    if (!selectedSpaceId || !selectedTableId || !detailRecord) return;
    setPanelLoading(true);
    try {
      const response = await knowledgeRequest<{ attachments: KnowledgeAttachment[] }>(
        `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records/${detailRecord.id}/attachments`
      );
      setRecordAttachments(response.attachments);
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : "附件加载失败。");
    } finally {
      setPanelLoading(false);
    }
  }, [detailRecord, selectedSpaceId, selectedTableId]);

  const uploadAttachment = useCallback(
    async (file: File) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId || !detailRecord) return;
      if (file.size > 20 * 1024 * 1024) {
        setError("单个附件不能超过 20MB。");
        return;
      }
      setPanelLoading(true);
      try {
        const body = new FormData();
        body.set("file", file);
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records/${detailRecord.id}/attachments`,
          { body, method: "POST" }
        );
        await loadAttachments();
        setMessage("附件已上传");
      } catch (attachmentError) {
        setError(attachmentError instanceof Error ? attachmentError.message : "附件上传失败。");
      } finally {
        setPanelLoading(false);
      }
    },
    [canWrite, detailRecord, loadAttachments, selectedSpaceId, selectedTableId]
  );

  const removeAttachment = useCallback(
    async (attachment: KnowledgeAttachment) => {
      if (!canWrite || !selectedSpaceId || !selectedTableId || !detailRecord || !window.confirm(`删除附件“${attachment.fileName}”？`)) return;
      try {
        await knowledgeRequest(
          `/spaces/${selectedSpaceId}/tables/${selectedTableId}/records/${detailRecord.id}/attachments/${attachment.id}?revision=${attachment.revision}`,
          { method: "DELETE" }
        );
        await loadAttachments();
      } catch (attachmentError) {
        setError(attachmentError instanceof Error ? attachmentError.message : "附件删除失败。");
      }
    },
    [canWrite, detailRecord, loadAttachments, selectedSpaceId, selectedTableId]
  );

  const submitFormRecord = useCallback(async () => {
    if (!canWrite || !selectedSpaceId || !selectedTableId) return;
    const values = Object.fromEntries(
      fields.map((field) => [
        field.id,
        parseInputValue(field, formValues[field.id] ?? (field.fieldType === "checkbox" ? false : ""))
      ])
    );
    setSaving(true);
    try {
      await knowledgeRequest(`/spaces/${selectedSpaceId}/tables/${selectedTableId}/records`, {
        body: JSON.stringify({ sortOrder: recordTotal * 10, values }),
        method: "POST"
      });
      setFormValues({});
      await loadWorkspace(selectedSpaceId, selectedTableId);
      setMessage("表单已提交并创建记录");
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : "表单提交失败。");
    } finally {
      setSaving(false);
    }
  }, [canWrite, fields, formValues, loadWorkspace, recordTotal, selectedSpaceId, selectedTableId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (panel === "share") void loadMembers();
      if (panel === "comments") void loadComments();
      if (panel === "history") void loadVersions();
      if (panel === "trash") void loadTrash();
      if (panel === "automation" && canWrite && mode === "table") void loadAutomations();
      if (panel === "notifications") {
        if (detailRecord) void loadRecordActivities();
        if (canWrite && mode === "table" && selectedTableId) void loadAutomations();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canWrite, detailRecord, loadAutomations, loadComments, loadMembers, loadRecordActivities, loadTrash, loadVersions, mode, panel, selectedTableId]);

  useEffect(() => {
    if (!detailRecord) return;
    const timer = window.setTimeout(() => {
      if (recordTab === "comments") void loadComments();
      if (recordTab === "activity") void loadRecordActivities();
      if (recordTab === "attachments") void loadAttachments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [detailRecord, loadAttachments, loadComments, loadRecordActivities, recordTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setComments([]);
      setRecordActivities([]);
      setRecordAttachments([]);
      setCommentDraft("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [detailRecordId]);

  const filteredPages = useMemo(
    () => pages.filter((page) => page.title.toLowerCase().includes(search.toLowerCase())),
    [pages, search]
  );
  const filteredTables = useMemo(
    () => tables.filter((table) => table.title.toLowerCase().includes(search.toLowerCase())),
    [search, tables]
  );
  const filteredFields = useMemo(() => {
    const query = fieldSearch.trim().toLocaleLowerCase("zh-CN");
    if (!query) return fields;
    return fields.filter((field) =>
      `${field.name} ${fieldTypeLabels[field.fieldType]}`.toLocaleLowerCase("zh-CN").includes(query)
    );
  }, [fieldSearch, fields]);
  const visibleFields = useMemo(() => {
    const configured = selectedView?.visibleFieldIds ?? [];
    return configured.length ? fields.filter((field) => configured.includes(field.id)) : fields;
  }, [fields, selectedView]);
  const visibleRecords = useMemo(() => {
    const term = recordSearch.trim().toLowerCase();
    const next = records.filter((record) => {
      const matchesSearch = term
        ? Object.values(record.values).some((value) =>
            stringifyValue(value).toLowerCase().includes(term)
          )
        : true;
      if (!matchesSearch || !filterConditions.length) return matchesSearch;
      const results = filterConditions.map((condition) =>
        matchesFilter(record.values[condition.fieldId], condition)
      );
      return filterConjunction === "or" ? results.some(Boolean) : results.every(Boolean);
    });
    if (!sortRules.length) return next;
    return [...next].sort((left, right) => {
      for (const rule of sortRules) {
        const comparison = stringifyValue(left.values[rule.fieldId]).localeCompare(
          stringifyValue(right.values[rule.fieldId]),
          "zh-CN",
          { numeric: true }
        );
        if (comparison) return rule.direction === "desc" ? -comparison : comparison;
      }
      return left.sortOrder - right.sortOrder;
    });
  }, [filterConditions, filterConjunction, recordSearch, records, sortRules]);

  const groupedRecords = useMemo(() => {
    if (!groupRules.length) return [["全部记录", visibleRecords]] as Array<[string, KnowledgeRecord[]]>;
    const groups = new Map<string, KnowledgeRecord[]>();
    for (const record of visibleRecords) {
      const key = groupRules
        .map((rule) => stringifyValue(record.values[rule.fieldId]) || "未分组")
        .join(" / ");
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    return [...groups.entries()];
  }, [groupRules, visibleRecords]);
  const distributionField = fields.find((field) => field.fieldType === "select");
  const recordDistribution = useMemo(() => {
    if (!distributionField) return [];
    const counts = new Map<string, number>();
    for (const record of records) {
      const key = stringifyValue(record.values[distributionField.id]) || "未分类";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [distributionField, records]);
  const dateFields = useMemo(
    () => fields.filter((field) => field.fieldType === "date"),
    [fields]
  );
  const calendarField = dateFields[0];
  const calendarRecordGroups = useMemo(() => {
    const groups = new Map<string, KnowledgeRecord[]>();
    for (const record of visibleRecords) {
      const raw = calendarField ? stringifyValue(record.values[calendarField.id]) : "";
      const parsed = raw ? new Date(raw) : null;
      const key = parsed && Number.isFinite(parsed.getTime()) ? dateKey(parsed) : "unscheduled";
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    return groups;
  }, [calendarField, visibleRecords]);
  const calendarDays = useMemo(() => {
    const anchor = new Date(`${calendarAnchor}T12:00:00`);
    const start = new Date(anchor);
    let count = 1;
    if (calendarScale === "month") {
      start.setDate(1);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      count = 42;
    } else if (calendarScale === "week") {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      count = 7;
    }
    return Array.from({ length: count }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [calendarAnchor, calendarScale]);
  const moveCalendar = useCallback((direction: -1 | 1) => {
    const next = new Date(`${calendarAnchor}T12:00:00`);
    if (calendarScale === "month") next.setMonth(next.getMonth() + direction);
    else if (calendarScale === "week") next.setDate(next.getDate() + direction * 7);
    else next.setDate(next.getDate() + direction);
    setCalendarAnchor(dateKey(next));
  }, [calendarAnchor, calendarScale]);
  const ganttBars = useMemo(() => {
    const startField = dateFields[0];
    const endField = dateFields[1] ?? startField;
    if (!startField || !endField) return [];
    const raw = visibleRecords.flatMap((record) => {
      const start = new Date(stringifyValue(record.values[startField.id])).getTime();
      const end = new Date(stringifyValue(record.values[endField.id])).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
      return [{ end: Math.max(start, end), record, start: Math.min(start, end) }];
    });
    if (!raw.length) return [];
    const min = Math.min(...raw.map((item) => item.start));
    const max = Math.max(...raw.map((item) => item.end));
    const range = Math.max(86_400_000, max - min + 86_400_000);
    return raw.map((item) => ({
      ...item,
      left: ((item.start - min) / range) * 100,
      width: Math.max(3, ((item.end - item.start + 86_400_000) / range) * 100)
    }));
  }, [dateFields, visibleRecords]);

  const toggleFieldVisibility = useCallback(
    async (fieldId: string) => {
      if (!selectedView) return;
      const current = selectedView.visibleFieldIds.length
        ? selectedView.visibleFieldIds
        : fields.map((field) => field.id);
      const next = current.includes(fieldId)
        ? current.filter((id) => id !== fieldId)
        : [...current, fieldId];
      await updateSelectedView({ visibleFieldIds: next });
    },
    [fields, selectedView, updateSelectedView]
  );
  const detailRecordIndex = detailRecord
    ? visibleRecords.findIndex((record) => record.id === detailRecord.id)
    : -1;

  function renderCell(record: KnowledgeRecord, field: KnowledgeField, compact = false) {
    const value = record.values[field.id];
    if (["attachment", "autonumber", "created_time", "formula", "lookup", "updated_time"].includes(field.fieldType)) {
      return <span className={styles.readonlyCell}>{stringifyValue(value) || (field.fieldType === "attachment" ? "在附件页签管理" : "自动计算")}</span>;
    }
    if (field.fieldType === "checkbox") {
      return (
        <label className={styles.checkboxCell}>
          <input
            checked={Boolean(value)}
            className={styles.checkbox}
            disabled={!canWrite}
            onChange={(event) => void updateRecordValue(record, field, event.target.checked)}
            type="checkbox"
          />
          {compact ? null : Boolean(value) ? "完成" : "未完成"}
        </label>
      );
    }
    if (field.fieldType === "select") {
      return (
        <select
          className={styles.cellSelect}
          disabled={!canWrite}
          onChange={(event) => void updateRecordValue(record, field, event.target.value)}
          value={stringifyValue(value)}
        >
          <option value="">未选择</option>
          {fieldOptions(field).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        className={styles.cellInput}
        defaultValue={stringifyValue(value)}
        key={`${record.id}-${field.id}-${record.revision}`}
        onBlur={(event) => {
          if (canWrite && event.target.value !== stringifyValue(value)) {
            void updateRecordValue(record, field, event.target.value);
          }
        }}
        placeholder="留空"
        readOnly={!canWrite}
        type={field.fieldType === "number" || field.fieldType === "currency" || field.fieldType === "progress" || field.fieldType === "rating" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "url" ? "url" : field.fieldType === "email" ? "email" : field.fieldType === "phone" ? "tel" : "text"}
      />
    );
  }

  function renderPageNodes(parentId?: string, depth = 0): ReactNode {
    const children = filteredPages
      .filter((page) => (page.parentId || undefined) === parentId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    return children.map((page) => (
      <div className={styles.pageNode} key={page.id}>
        <div
          className={cn(styles.pageRow, selectedPageId === page.id && styles.pageRowActive)}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <button
            aria-label={expandedPageIds.includes(page.id) ? "收起子页面" : "展开子页面"}
            className={styles.treeToggle}
            disabled={!filteredPages.some((item) => item.parentId === page.id)}
            onClick={() =>
              setExpandedPageIds((current) =>
                current.includes(page.id)
                  ? current.filter((id) => id !== page.id)
                  : [...current, page.id]
              )
            }
            type="button"
          >
            <ChevronRight
              className={cn(styles.treeChevron, expandedPageIds.includes(page.id) && styles.treeChevronOpen)}
            />
          </button>
          <button className={styles.pageLink} onClick={() => void openPage(page.id)} type="button">
            <FileText className={styles.pageIcon} />
            <span>{page.title}</span>
          </button>
          {canWrite ? <div className={styles.pageRowActions}>
            <button
              aria-label={`在 ${page.title} 下新建页面`}
              onClick={() => void (async () => {
                if (!(await openPage(page.id))) return;
                setCreateKind("page");
              })()}
              type="button"
            >
              <Plus />
            </button>
            <button
              aria-label={`${page.title} 页面菜单`}
              onClick={() => setPageActionId((current) => (current === page.id ? "" : page.id))}
              type="button"
            >
              <MoreHorizontal />
            </button>
          </div> : null}
          {canWrite && pageActionId === page.id ? (
            <div className={styles.treeMenu}>
              <button onClick={() => void movePage(page, -1)} type="button">上移</button>
              <button onClick={() => void movePage(page, 1)} type="button">下移</button>
              <button onClick={() => void openPage(page.id).then((opened) => { if (opened) { setPanel("more"); setPageActionId(""); } })} type="button">页面设置</button>
            </div>
          ) : null}
        </div>
        {expandedPageIds.includes(page.id) ? renderPageNodes(page.id, depth + 1) : null}
      </div>
    ));
  }

  const documentStatusLabel =
    !canWrite
      ? `只读·${accessRole === "commenter" ? "可评论" : "仅查看"}`
      : documentStatus === "saving"
      ? "保存中…"
      : documentStatus === "dirty"
        ? "等待自动保存"
        : documentStatus === "conflict"
          ? "版本冲突，请刷新"
          : `已自动保存 · 版本 ${selectedPage?.revision ?? 1}`;

  return (
    <section className={styles.workspace}>
      {error || message ? (
        <div className={cn(styles.toast, error && styles.toastError)}>
          <span>{error || message}</span>
          <button aria-label="关闭提示" onClick={() => { setError(""); setMessage(""); }} type="button">
            <X />
          </button>
        </div>
      ) : null}

      <div className={cn(styles.desktopShell, sidebarCollapsed && styles.desktopShellCollapsed)}>
        <nav aria-label="灵穹全局导航" className={styles.globalRail}>
          <Link aria-label="灵穹首页" className={styles.railBrand} href="/">穹</Link>
          <button aria-label={sidebarCollapsed ? "展开知识库侧边栏" : "收起知识库侧边栏"} className={styles.railButton} onClick={() => setSidebarCollapsed((current) => !current)} type="button"><Menu /></button>
          <button aria-label="知识库首页" className={cn(styles.railButton, mode === "home" && styles.railButtonActive)} onClick={() => void openHome()} type="button"><Home /></button>
          <Link aria-label="项目中心" className={styles.railButton} href="/projects"><LayoutDashboard /></Link>
          <Link aria-label="创作台" className={styles.railButton} href="/projects"><Sparkles /></Link>
          <Link aria-label="技能工作台" className={styles.railButton} href="/skills"><Zap /></Link>
          <span className={styles.railSpacer} />
          <button aria-label="工作台设置" className={styles.railButton} onClick={() => setPanel("more")} type="button"><CircleHelp /></button>
          <span className={styles.avatar}>灵</span>
        </nav>

        <aside className={cn(styles.wikiSidebar, sidebarCollapsed && styles.wikiSidebarCollapsed)}>
          <div className={styles.sidebarBrand}>
            <button aria-label="折叠菜单" onClick={() => setSidebarCollapsed(true)} type="button"><Menu /></button>
            <div><strong>灵穹知识库</strong><span>团队知识与生产数据</span></div>
            {canWrite ? <button aria-label="新建" onClick={() => setCreateKind(selectedSpaceId ? "page" : "space")} type="button"><Plus /></button> : <span />}
          </div>

          <button className={styles.sidebarHome} onClick={() => void openHome()} type="button">
            <Home />知识库首页
          </button>

          <div className={styles.spaceSwitcher}>
            <span className={styles.spaceMark} style={{ backgroundColor: selectedSpace?.color || "#3370ff" }} />
            <select onChange={(event) => void openSpace(event.target.value)} value={selectedSpaceId}>
              {spaces.map((space) => <option key={space.id} value={space.id}>{space.title}</option>)}
            </select>
            {canWrite ? <button aria-label="新建知识空间" onClick={() => setCreateKind("space")} type="button"><Plus /></button> : <span />}
          </div>

          <label className={styles.sidebarSearch}>
            <Search />
            <input id="knowledge-search" onChange={(event) => { const value = event.target.value; setSearch(value); if (value.trim().length < 2) { setSearchResults([]); setSearchLoading(false); } }} placeholder="搜索当前知识空间" value={search} />
            <kbd>⌘ K</kbd>
          </label>
          {search.trim().length >= 2 ? (
            <div className={styles.searchPopover}>
              <header><strong>全局搜索</strong><span>{searchLoading ? "搜索中…" : `${searchResults.length} 项结果`}</span></header>
              {searchResults.map((result) => (
                <button key={`${result.kind}-${result.id}`} onClick={() => void openSearchResult(result)} type="button">
                  <span>{result.kind === "page" ? <FileText /> : result.kind === "table" ? <Table2 /> : <Rows3 />}</span>
                  <div><strong>{result.title}</strong><small>{result.snippet || (result.kind === "record" ? "多维表格记录" : "知识库内容")}</small></div>
                  <em>{result.kind === "page" ? "文档" : result.kind === "table" ? "数据表" : "记录"}</em>
                </button>
              ))}
              {!searchLoading && !searchResults.length ? <p>没有找到匹配的知识内容。</p> : null}
            </div>
          ) : null}

          <div className={styles.directoryHeader}>
            <span>目录</span>
            <div>
              <button aria-label="刷新目录" onClick={() => void refreshCurrent()} type="button"><RefreshCw className={cn(loading && styles.spin)} /></button>
              {canWrite ? <button aria-label="新建页面" onClick={() => setCreateKind("page")} type="button"><Plus /></button> : null}
              <button aria-label="收起全部目录" onClick={() => setExpandedPageIds([])} type="button"><Minus /></button>
            </div>
          </div>

          <div className={styles.pageTree}>
            {filteredPages.length ? renderPageNodes() : <p className={styles.sidebarEmpty}>还没有文档，点击 + 新建。</p>}
          </div>

          <div className={styles.directoryHeader}>
            <span>多维表格</span>
            {canWrite ? <button aria-label="新建多维表格" onClick={() => setCreateKind("table")} type="button"><Plus /></button> : null}
          </div>
          <div className={styles.tableTree}>
            {filteredTables.map((table) => (
              <button className={cn(selectedTableId === table.id && styles.treeItemActive)} key={table.id} onClick={() => void openTable(table.id)} type="button">
                <Table2 /><span>{table.title}</span>
              </button>
            ))}
          </div>

          <div className={styles.sidebarFooter}>
            <Link href="/bookstack/" target="_blank"><BookOpen />历史知识库<ChevronRight /></Link>
            <button onClick={() => setPanel("trash")} type="button"><Trash2 />回收站<span>{trashItems.length ? `${trashItems.length} 项` : ""}</span></button>
            <p>{selectedSpace ? `${selectedSpace.title} · ${pages.length + tables.length} 项内容` : "选择一个知识空间"}</p>
          </div>
        </aside>

        <section className={styles.contentShell}>
          <header className={styles.topbar}>
            <div className={styles.breadcrumbs}>
              <span>{selectedSpace?.title || "知识库"}</span>
              {mode !== "home" ? <ChevronRight /> : null}
              {mode === "page" ? <strong>{selectedPage?.title}</strong> : null}
              {mode === "table" ? <strong>{selectedTable?.title}</strong> : null}
              <span className={styles.modified}>{mode === "page" ? documentStatusLabel : selectedTable ? `最近修改 ${formatDate(selectedTable.updatedAt)}` : "云端工作区"}</span>
            </div>
            <div className={styles.topbarActions}>
              {mode === "page" ? <button aria-label="版本历史" onClick={() => setPanel("history")} type="button"><Clock3 /></button> : null}
              <button className={styles.shareButton} onClick={() => setPanel("share")} type="button"><Share2 />分享</button>
              {canManage ? <button className={styles.permissionButton} onClick={() => setPanel("share")} type="button"><ShieldCheck />高级权限</button> : null}
              {canWrite && mode === "table" ? <button aria-label="自动化" onClick={() => setPanel("automation")} type="button"><Zap /></button> : null}
              <button aria-label="评论" onClick={() => setPanel("comments")} type="button"><MessageSquare /></button>
              <button aria-label="通知" onClick={() => setPanel("notifications")} type="button"><Bell /></button>
              <button aria-label="更多" onClick={() => setPanel("more")} type="button"><MoreHorizontal /></button>
              <button aria-label="搜索" onClick={() => document.getElementById("knowledge-search")?.focus()} type="button"><Search /></button>
              {canWrite ? <button aria-label="新建内容" onClick={() => setCreateKind(mode === "table" ? "table" : "page")} type="button"><Plus /></button> : null}
              <span className={styles.topAvatar}>灵</span>
            </div>
          </header>

          {loading && !spaces.length ? (
            <div className={styles.loading}><Loader2 className={styles.spin} /><span>正在加载知识空间…</span></div>
          ) : mode === "page" && selectedPage ? (
            <main className={styles.documentViewport}>
              <aside className={styles.documentOutline}>
                <span>本文目录</span>
                {documentBlocks.filter((block) => block.type === "heading1" || block.type === "heading2").map((block) => (
                  <button className={block.type === "heading2" ? styles.outlineLevel2 : undefined} key={block.id} onClick={() => focusDocumentBlock(block.id)} type="button">{block.text || "未命名标题"}</button>
                ))}
              </aside>
              <article className={styles.documentPage}>
                <div className={styles.documentMeta}>
                  <span>📘</span>
                </div>
                <input className={styles.documentTitle} maxLength={255} onChange={(event) => setPageTitle(event.target.value)} placeholder="无标题文档" readOnly={!canWrite} value={pageTitle} />
                <div className={styles.authorLine}>
                  <span className={styles.miniAvatar}>灵</span>
                  <span>{selectedSpace?.ownerAccount || "灵穹团队"}</span>
                  <span>更新于 {formatDate(selectedPage.updatedAt)}</span>
                  <span className={cn(documentStatus === "conflict" && styles.statusConflict)}><Cloud />{documentStatusLabel}</span>
                </div>
                <div className={styles.blockEditor}>
                  {documentBlocks.map((block) => (
                    <div className={cn(styles.blockRow, styles[`block_${block.type}`])} key={block.id}>
                      {canWrite ? <div className={styles.blockControls}>
                        <button aria-label="插入内容块" onClick={() => setSlashBlockId(block.id)} type="button"><Plus /></button>
                        <button aria-label="打开内容块菜单" onClick={() => setSlashBlockId(block.id)} type="button"><MoreHorizontal /></button>
                      </div> : <div />}
                      {block.type === "divider" ? (
                        <div className={styles.dividerBlock}><hr /></div>
                      ) : (
                        <div className={styles.blockInputWrap}>
                          {block.type === "todo" ? <input aria-label="完成待办" checked={Boolean(block.checked)} className={styles.todoCheckbox} disabled={!canWrite} onChange={(event) => updateDocumentBlock(block.id, { checked: event.target.checked })} type="checkbox" /> : null}
                          {block.type === "callout" ? <span className={styles.calloutIcon}>💡</span> : null}
                          <textarea
                            aria-label="文档内容块"
                            className={styles.blockInput}
                            id={`knowledge-block-${block.id}`}
                            onChange={(event) => {
                              updateDocumentBlock(block.id, { text: event.target.value });
                              if (event.target.value === "/") setSlashBlockId(block.id);
                              else if (slashBlockId === block.id && !event.target.value.startsWith("/")) setSlashBlockId("");
                            }}
                            onInput={(event) => {
                              event.currentTarget.style.height = "0";
                              event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                            }}
                            onKeyDown={(event) => handleBlockKeyDown(event, block)}
                            onSelect={(event) =>
                              setSelectedTextBlockId(
                                event.currentTarget.selectionStart !== event.currentTarget.selectionEnd
                                  ? block.id
                                  : ""
                              )
                            }
                            placeholder={block.type === "code" ? "输入代码…" : block.type === "todo" ? "待办事项" : "输入 / 插入内容"}
                            readOnly={!canWrite}
                            rows={1}
                            value={block.text}
                          />
                        </div>
                      )}
                      {canWrite && selectedTextBlockId === block.id ? (
                        <div className={styles.selectionToolbar}>
                          <button aria-label="加粗" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelectedText(block.id, "**")} type="button"><strong>B</strong></button>
                          <button aria-label="斜体" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelectedText(block.id, "_")} type="button"><em>I</em></button>
                          <button aria-label="行内代码" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelectedText(block.id, "`")} type="button"><Code2 /></button>
                          <button aria-label="添加链接" onMouseDown={(event) => event.preventDefault()} onClick={() => formatSelectedText(block.id, "[", "](https://)")} type="button"><Link2 /></button>
                        </div>
                      ) : null}
                      {canWrite && slashBlockId === block.id ? (
                        <div className={styles.slashMenu}>
                          <div><strong>插入内容</strong><span>基础块</span></div>
                          {([
                            ["paragraph", "正文", AlignLeft],
                            ["heading1", "一级标题", Heading1],
                            ["heading2", "二级标题", Text],
                            ["todo", "待办事项", CheckSquare],
                            ["quote", "引用", Quote],
                            ["divider", "分割线", Minus],
                            ["code", "代码块", Code2],
                            ["callout", "提示块", Sparkles]
                          ] as Array<[BlockType, string, typeof FileText]>).map(([type, label, Icon]) => (
                            <button key={type} onClick={() => chooseBlockType(block.id, type)} type="button"><span><Icon /></span><div><strong>{label}</strong><small>{type === "paragraph" ? "普通文本段落" : type === "todo" ? "可勾选任务" : `插入${label}`}</small></div></button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {canWrite ? <button className={styles.appendBlock} onClick={() => insertDocumentBlock(documentBlocks.at(-1)?.id ?? "")} type="button"><Plus />点击添加内容块，或输入 /</button> : null}
                </div>
              </article>
            </main>
          ) : mode === "table" && selectedTable ? (
            <main className={styles.baseWorkspace}>
              <aside className={styles.baseNavigator}>
                <div className={styles.baseNavTitle}><Table2 /><strong>{selectedTable.title}</strong><button aria-label="表格菜单" onClick={() => setPanel("more")} type="button"><MoreHorizontal /></button></div>
                <div className={styles.baseNavSection}><span>数据表</span>{canWrite ? <button aria-label="新建数据表" onClick={() => setCreateKind("table")} type="button"><Plus /></button> : null}</div>
                {tables.map((table) => <button className={cn(styles.baseNavItem, baseSection === "table" && table.id === selectedTableId && styles.baseNavItemActive)} key={table.id} onClick={() => void openTable(table.id)} type="button"><Grid3X3 /><span>{table.title}</span></button>)}
                <div className={styles.baseNavDivider} />
                <div className={styles.baseNavSection}><span>应用</span></div>
                <button className={cn(styles.baseNavItem, baseSection === "dashboard" && styles.baseNavItemActive)} onClick={() => setBaseSection("dashboard")} type="button"><LayoutDashboard /><span>仪表盘</span><small>实时统计</small></button>
                {canWrite ? <button className={cn(styles.baseNavItem, baseSection === "automation" && styles.baseNavItemActive)} onClick={() => setBaseSection("automation")} type="button"><Zap /><span>工作流</span><small>{automations.length} 条</small></button> : null}
              </aside>

              <section className={styles.baseContent}>
                {baseSection === "dashboard" ? <div className={styles.baseModulePage}><header><div><span>数据分析</span><h1>{selectedTable.title} · 仪表盘</h1><p>所有组件读取同一张数据表，记录变化会实时同步。</p></div><button onClick={() => setBaseSection("table")} type="button"><Grid3X3 />返回数据表</button></header><section className={styles.dashboardMetricGrid}><article><span>记录总数</span><strong>{recordTotal}</strong><small>当前加载 {records.length} 条</small></article><article><span>字段数量</span><strong>{fields.length}</strong><small>{visibleFields.length} 个在当前视图显示</small></article><article><span>视图数量</span><strong>{views.length}</strong><small>{Object.keys(viewTypeLabels).filter((type) => views.some((view) => view.viewType === type)).length} 种视图类型</small></article><article><span>自动化</span><strong>{automations.filter((rule) => rule.enabled).length}</strong><small>{automations.length} 条工作流</small></article></section><section className={styles.dashboardChart}><header><div><span>分类分布</span><strong>{distributionField?.name || "记录概览"}</strong></div><small>{recordDistribution.length} 个分类</small></header>{recordDistribution.length ? recordDistribution.map(([label, count]) => <div key={label}><span>{label}</span><div><i style={{ width: `${Math.max(4, (count / Math.max(1, records.length)) * 100)}%` }} /></div><strong>{count}</strong></div>) : <EmptyState description="添加单选字段后，这里会自动生成实时分类图表。" title="等待可视化字段" />}</section></div> : baseSection === "automation" ? <div className={styles.baseModulePage}><header><div><span>自动化</span><h1>{selectedTable.title} · 工作流</h1><p>通过触发器连接记录变化、通知与生产动作。</p></div><button onClick={() => setBaseSection("table")} type="button"><Grid3X3 />返回数据表</button></header><div className={styles.automationWorkspace}><section className={styles.automationCreate}><strong>新建工作流</strong><input maxLength={255} onChange={(event) => setAutomationName(event.target.value)} placeholder="例如：新增记录后通知制片" value={automationName} /><select onChange={(event) => setAutomationTrigger(event.target.value as AutomationTrigger)} value={automationTrigger}><option value="manual">手动触发</option><option value="record_created">新增记录</option><option value="record_updated">更新记录</option><option value="field_changed">字段变化</option><option value="schedule">定时运行</option></select><button className={styles.primaryAction} disabled={panelLoading || !automationName.trim()} onClick={() => void createAutomation()} type="button"><Plus />创建工作流</button></section><section className={styles.automationRules}>{automations.map((rule) => <article className={selectedAutomationId === rule.id ? styles.automationRuleActive : undefined} key={rule.id} onClick={() => { setSelectedAutomationId(rule.id); void loadAutomationRuns(rule.id); }}><header><div><strong>{rule.name}</strong><span>{rule.triggerType}</span></div><label><input checked={rule.enabled} onChange={() => void toggleAutomation(rule)} onClick={(event) => event.stopPropagation()} type="checkbox" />{rule.enabled ? "已启用" : "已停用"}</label></header><footer><small>更新于 {formatDate(rule.updatedAt)}</small><button disabled={!rule.enabled || panelLoading} onClick={(event) => { event.stopPropagation(); void runAutomation(rule); }} type="button"><Zap />运行</button><button aria-label="删除规则" onClick={(event) => { event.stopPropagation(); void removeAutomation(rule); }} type="button"><Trash2 /></button></footer></article>)}{!automations.length ? <EmptyState description="创建第一条工作流，让重复动作自动执行。" title="暂无工作流" /> : null}</section><section className={styles.automationRuns}><header><strong>运行日志</strong><span>{automationRuns.length} 次</span></header>{automationRuns.map((run) => <article key={run.id}><span className={cn(styles.runStatus, styles[`run_${run.status}`])}>{run.status}</span><div><strong>{run.recordId ? `记录 ${run.recordId.slice(0, 8)}` : "手动运行"}</strong><small>{formatDate(run.createdAt)}{run.error ? ` · ${run.error}` : ""}</small></div></article>)}{!automationRuns.length ? <p className={styles.drawerEmpty}>选择工作流后查看运行日志。</p> : null}</section></div></div> : <>
                <div className={styles.baseTitlebar}>
                  <div><h1>{selectedTable.title}</h1><p>{selectedTable.description || "用结构化数据连接影视生产流程"}</p></div>
                  <div><button onClick={() => setPanel("share")} type="button"><Share2 />分享</button>{canWrite ? <button onClick={() => setPanel("automation")} type="button"><Zap />自动化</button> : null}<button aria-label="通知" onClick={() => setPanel("notifications")} type="button"><Bell /></button><button aria-label="更多" onClick={() => setPanel("more")} type="button"><MoreHorizontal /></button><button aria-label="查找" onClick={() => document.getElementById("record-search")?.focus()} type="button"><Search /></button>{canWrite ? <button aria-label="新建" onClick={() => void addRecord()} type="button"><Plus /></button> : null}</div>
                </div>

                <div className={styles.viewTabs}>
                  {views.map((view) => { const Icon = viewTypeIcons[view.viewType]; return <div className={cn(styles.viewTabItem, selectedViewId === view.id && styles.viewTabActive)} key={view.id}><button onClick={() => activateView(view)} type="button"><Icon />{view.name}{view.isDefault ? <span className={styles.defaultViewMark}>默认</span> : null}</button>{canWrite ? <button aria-label={`${view.name} 视图菜单`} onClick={() => setViewActionId((current) => current === view.id ? "" : view.id)} type="button"><MoreHorizontal /></button> : null}{viewActionId === view.id ? <div className={styles.viewMenu}><button onClick={() => void renameView(view)} type="button">重命名</button><button onClick={() => void duplicateView(view)} type="button"><Copy />复制视图</button><button disabled={view.isDefault} onClick={() => void makeDefaultView(view)} type="button">设为默认视图</button><button className={styles.dangerText} onClick={() => void removeView(view)} type="button"><Trash2 />删除视图</button></div> : null}</div>; })}
                  {canWrite ? <button onClick={() => setCreateKind("view")} type="button"><Plus />新建视图</button> : null}
                </div>

                <div className={styles.baseToolbar}>
                  {canWrite ? <div className={styles.toolbarMain}>
                    <button className={styles.addRecordButton} onClick={() => void addRecord()} type="button"><Plus />添加记录</button>
                    <button onClick={() => setPanel("field-settings")} type="button"><Settings2 />字段配置</button>
                    <button onClick={() => setPanel("view-settings")} type="button"><Eye />视图配置</button>
                    <button className={filterConditions.length ? styles.toolbarActive : undefined} onClick={() => setPanel("filter")} type="button"><Filter />筛选{filterConditions.length ? ` ${filterConditions.length}` : ""}</button>
                    <button className={groupRules.length ? styles.toolbarActive : undefined} onClick={() => setPanel("group")} type="button"><Columns3 />分组{groupRules.length ? ` ${groupRules.length}` : ""}</button>
                    <button className={sortRules.length ? styles.toolbarActive : undefined} onClick={() => setPanel("sort")} type="button"><ArrowUpDown />排序{sortRules.length ? ` ${sortRules.length}` : ""}</button>
                    <button onClick={() => setPanel("row-height")} type="button"><Rows3 />行高</button>
                  </div> : <div />}
                  <div className={styles.toolbarAside}>
                    <button onClick={() => setPanel("notifications")} type="button"><Bell />动态</button>
                    {canWrite ? <button onClick={() => { const formView = views.find((view) => view.viewType === "form"); if (formView) activateView(formView); else { setCreateViewType("form"); setCreateKind("view"); } }} type="button"><FileText />生成表单</button> : null}
                    <button onClick={() => setPanel("share")} type="button"><Share2 />分享</button>
                    <label className={styles.recordSearch}><Search /><input id="record-search" onChange={(event) => setRecordSearch(event.target.value)} placeholder="查找" value={recordSearch} /></label>
                  </div>
                </div>

                <div className={styles.dataViewport} data-row-height={selectedView?.rowHeight ?? "medium"}>
                  {displayMode === "kanban" ? (
                    <div className={styles.kanbanBoard}>{groupedRecords.map(([group, items]) => <section className={styles.kanbanColumn} key={group}><header><strong>{group}</strong><span>{items.length}</span></header><div>{items.map((record) => <button className={styles.kanbanCard} key={record.id} onClick={() => setDetailRecordId(record.id)} type="button"><strong>{stringifyValue(record.values[visibleFields[0]?.id]) || "未命名记录"}</strong>{visibleFields.slice(1, 4).map((field) => <span key={field.id}>{field.name} · {stringifyValue(record.values[field.id]) || "—"}</span>)}</button>)}</div></section>)}</div>
                  ) : displayMode === "gallery" ? (
                    <div className={styles.galleryGrid}>{visibleRecords.map((record) => <button className={styles.galleryCard} key={record.id} onClick={() => setDetailRecordId(record.id)} type="button"><div><Database /></div><strong>{stringifyValue(record.values[visibleFields[0]?.id]) || "未命名记录"}</strong>{visibleFields.slice(1, 4).map((field) => <span key={field.id}>{field.name} · {stringifyValue(record.values[field.id]) || "—"}</span>)}</button>)}</div>
                  ) : displayMode === "calendar" ? (
                    <div className={styles.calendarView}>{calendarField ? <><div className={styles.calendarToolbar}><div><button aria-label="上一时间段" onClick={() => moveCalendar(-1)} type="button"><ArrowLeft /></button><button onClick={() => setCalendarAnchor(dateKey(new Date()))} type="button">今天</button><button aria-label="下一时间段" onClick={() => moveCalendar(1)} type="button"><ArrowRight /></button><strong>{new Intl.DateTimeFormat("zh-CN", { day: calendarScale === "day" ? "numeric" : undefined, month: "long", year: "numeric" }).format(new Date(`${calendarAnchor}T12:00:00`))}</strong></div><select aria-label="日历显示范围" onChange={(event) => setCalendarScale(event.target.value as "day" | "month" | "week")} value={calendarScale}><option value="month">月</option><option value="week">周</option><option value="day">日</option></select></div>{calendarScale !== "day" ? <div className={styles.calendarWeekdays}>{["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => <span key={day}>{day}</span>)}</div> : null}<div className={cn(styles.calendarGrid, calendarScale === "day" && styles.calendarDayGrid)}>{calendarDays.map((day) => { const key = dateKey(day); const items = calendarRecordGroups.get(key) ?? []; const anchor = new Date(`${calendarAnchor}T12:00:00`); return <section className={cn(calendarScale === "month" && day.getMonth() !== anchor.getMonth() && styles.calendarMuted, key === dateKey(new Date()) && styles.calendarToday)} key={key}><header><strong>{day.getDate()}</strong><span>{items.length ? `${items.length} 条` : ""}</span></header><div>{items.slice(0, calendarScale === "day" ? 20 : 4).map((record) => <button key={record.id} onClick={() => setDetailRecordId(record.id)} type="button">{stringifyValue(record.values[visibleFields[0]?.id]) || "未命名记录"}</button>)}{items.length > (calendarScale === "day" ? 20 : 4) ? <small>还有 {items.length - (calendarScale === "day" ? 20 : 4)} 条</small> : null}</div></section>; })}</div>{calendarRecordGroups.get("unscheduled")?.length ? <div className={styles.unscheduledRecords}><strong>未安排日期</strong>{calendarRecordGroups.get("unscheduled")?.map((record) => <button key={record.id} onClick={() => setDetailRecordId(record.id)} type="button">{stringifyValue(record.values[visibleFields[0]?.id]) || "未命名记录"}</button>)}</div> : null}</> : <EmptyState description="添加日期字段后，日历视图会按日、周、月真实展示记录；当前没有可用日期字段。" title="缺少日期字段" />}</div>
                  ) : displayMode === "gantt" ? (
                    dateFields.length ? <div className={styles.ganttView}><header><div><strong>任务</strong><span>{dateFields[0].name} → {dateFields[1]?.name || dateFields[0].name}</span></div><div><span>时间轴</span></div></header>{ganttBars.map(({ left, record, width }) => <button key={record.id} onClick={() => setDetailRecordId(record.id)} type="button"><strong>{stringifyValue(record.values[visibleFields[0]?.id]) || "未命名记录"}</strong><div><span style={{ left: `${left}%`, width: `${width}%` }} /></div></button>)}{!ganttBars.length ? <p>已有日期字段，但当前记录尚未填写有效日期。</p> : null}</div> : <EmptyState action={<button className={styles.primaryAction} onClick={() => setPanel("field-settings")} type="button">添加日期字段</button>} description="甘特视图需要至少一个日期字段；有两个日期字段时会分别作为开始和结束日期。" title="配置甘特日期" />
                  ) : displayMode === "form" ? (
                    <div className={styles.formView}><form onSubmit={(event) => { event.preventDefault(); void submitFormRecord(); }}><header><FileText /><div><h2>{selectedTable.title} · 数据收集表</h2><p>{selectedTable.description || "填写下列字段并提交，数据会直接写入当前多维表格。"}</p></div></header>{fields.filter((field) => !["attachment", "autonumber", "created_time", "formula", "lookup", "updated_time"].includes(field.fieldType)).map((field) => <label key={field.id}><span>{field.name}<small>{fieldTypeLabels[field.fieldType]}</small></span>{field.fieldType === "checkbox" ? <input checked={Boolean(formValues[field.id])} disabled={!canWrite} onChange={(event) => setFormValues((current) => ({ ...current, [field.id]: event.target.checked }))} type="checkbox" /> : field.fieldType === "select" ? <select disabled={!canWrite} onChange={(event) => setFormValues((current) => ({ ...current, [field.id]: event.target.value }))} value={String(formValues[field.id] ?? "")}><option value="">请选择</option>{fieldOptions(field).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input disabled={!canWrite} onChange={(event) => setFormValues((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={`填写${field.name}`} type={field.fieldType === "date" ? "date" : field.fieldType === "number" || field.fieldType === "currency" || field.fieldType === "progress" || field.fieldType === "rating" ? "number" : field.fieldType === "email" ? "email" : field.fieldType === "phone" ? "tel" : field.fieldType === "url" ? "url" : "text"} value={String(formValues[field.id] ?? "")} />}</label>)}{canWrite ? <button className={styles.primaryAction} disabled={saving} type="submit">{saving ? <Loader2 className={styles.spin} /> : <Plus />}提交记录</button> : <p className={styles.panelHint}>当前权限仅可查看表单。</p>}</form></div>
                  ) : (
                    <div className={styles.gridWrap}>
                      <table className={styles.dataGrid}>
                        <thead><tr><th className={styles.rowNumber}>#</th>{visibleFields.map((field) => <th key={field.id}><div className={styles.fieldHeader}><span>{field.fieldType === "number" ? <Hash /> : field.fieldType === "date" ? <CalendarDays /> : field.fieldType === "person" ? <Users /> : field.fieldType === "checkbox" ? <CheckSquare /> : field.fieldType === "url" ? <Link2 /> : <ListFilter />}{field.name}</span><button aria-label={`${field.name} 字段菜单`} disabled={!canWrite} onClick={() => setFieldActionId((current) => current === field.id ? "" : field.id)} type="button"><MoreHorizontal /></button>{canWrite && fieldActionId === field.id ? <div className={styles.fieldMenu}><button onClick={() => openFieldEditor(field)} type="button">编辑字段配置</button><button onClick={() => void toggleFieldVisibility(field.id)} type="button"><EyeOff />隐藏字段</button><button className={styles.dangerText} onClick={() => void removeField(field)} type="button"><Trash2 />删除字段</button></div> : null}</div></th>)}<th className={styles.addFieldColumn}>{canWrite ? <button aria-label="新增字段" onClick={() => { setEditingFieldId(""); setCreateTitle(""); setCreateFieldType("text"); setCreateFieldOptions(""); setCreateFieldFormula(""); setCreateFieldRequired(false); setCreateKind("field"); }} type="button"><Plus /></button> : null}</th></tr></thead>
                        <tbody>{visibleRecords.map((record, index) => <tr key={record.id}><td className={styles.rowNumber}><button onClick={() => setDetailRecordId(record.id)} type="button">{index + 1}</button></td>{visibleFields.map((field) => <td key={field.id}>{renderCell(record, field, true)}</td>)}<td className={styles.addFieldColumn}><button aria-label="打开记录详情" onClick={() => setDetailRecordId(record.id)} type="button"><ChevronRight /></button></td></tr>)}</tbody>
                      </table>
                      {canWrite ? <button className={styles.gridAddRecord} onClick={() => void addRecord()} type="button"><Plus />添加记录</button> : null}
                    </div>
                  )}
                  {!visibleRecords.length && displayMode !== "gantt" && displayMode !== "form" ? <EmptyState action={canWrite ? <button className={styles.primaryAction} onClick={() => void addRecord()} type="button">添加第一条记录</button> : undefined} description={canWrite ? "当前视图还没有符合条件的记录，可添加记录或清空筛选条件。" : "当前视图还没有符合条件的记录。"} title="暂无记录" /> : null}
                  {records.length < recordTotal ? <button className={styles.loadMoreRecords} disabled={recordsLoadingMore} onClick={() => void loadMoreRecords()} type="button">{recordsLoadingMore ? <Loader2 className={styles.spin} /> : <Rows3 />}加载更多记录（已加载 {records.length}/{recordTotal}）</button> : null}
                </div>
                </>}
              </section>
            </main>
          ) : (
            <main className={styles.homeViewport}>
              <section className={styles.homeHero}><div><span>LINGQIONG KNOWLEDGE</span><h1>把团队经验沉淀成<br />可复用的生产资产</h1><p>用 Wiki 页面组织方法与规范，用多维表格连接角色、场景、镜头、模型和交付状态。</p></div>{canWrite ? <div><button onClick={() => setCreateKind("page")} type="button"><FileText />新建文档</button><button onClick={() => setCreateKind("table")} type="button"><Table2 />新建多维表格</button></div> : null}</section>
              <section className={styles.metricGrid}><MetricCard icon={<BookOpen />} label="知识空间" value={dashboard.spaceCount} /><MetricCard icon={<FileText />} label="协作文档" value={dashboard.pageCount} /><MetricCard icon={<Table2 />} label="多维表格" value={dashboard.tableCount} /><MetricCard icon={<Rows3 />} label="结构化记录" value={dashboard.recordCount} /></section>
              <div className={styles.homeColumns}><section><header><div><span>最近浏览</span><h2>继续工作</h2></div><Clock3 /></header><div className={styles.recentList}>{dashboard.recentPages.map((page) => <button key={page.id} onClick={() => { if (page.spaceId !== selectedSpaceId) void openSpace(page.spaceId).then((opened) => { if (opened) void openPage(page.id); }); else void openPage(page.id); }} type="button"><span><FileText /></span><div><strong>{page.title}</strong><small>更新于 {formatDate(page.updatedAt)}</small></div><ChevronRight /></button>)}</div></section><section><header><div><span>知识空间</span><h2>团队空间</h2></div><ShieldCheck /></header><div className={styles.spaceCards}>{spaces.map((space) => <button key={space.id} onClick={() => void openSpace(space.id)} type="button"><span style={{ backgroundColor: space.color }} /><strong>{space.title}</strong><small>{space.description || "团队知识空间"}</small></button>)}</div></section></div>
            </main>
          )}
        </section>
      </div>

      {detailRecord ? (
        <aside className={styles.recordDrawer}>
          <header><div><span>记录详情</span><strong>{stringifyValue(detailRecord.values[visibleFields[0]?.id]) || "未命名记录"}</strong></div><div><button aria-label="上一条" disabled={detailRecordIndex <= 0} onClick={() => setDetailRecordId(visibleRecords[detailRecordIndex - 1]?.id ?? detailRecord.id)} type="button"><ArrowLeft /></button><button aria-label="下一条" disabled={detailRecordIndex < 0 || detailRecordIndex >= visibleRecords.length - 1} onClick={() => setDetailRecordId(visibleRecords[detailRecordIndex + 1]?.id ?? detailRecord.id)} type="button"><ArrowRight /></button><button aria-label="关闭" onClick={() => setDetailRecordId("")} type="button"><X /></button></div></header>
          <div className={styles.drawerSync}><Cloud />云端版本 {detailRecord.revision}</div>
          <div className={styles.recordTabs}>{([['fields', '字段'], ['comments', '评论'], ['activity', '活动'], ['attachments', '附件']] as Array<[RecordDrawerTab, string]>).map(([tab, label]) => <button className={recordTab === tab ? styles.recordTabActive : undefined} key={tab} onClick={() => setRecordTab(tab)} type="button">{label}{tab === "comments" && comments.length ? <span>{comments.length}</span> : tab === "attachments" && recordAttachments.length ? <span>{recordAttachments.length}</span> : null}</button>)}</div>
          {recordTab === "fields" ? <div className={styles.recordFields}>{fields.map((field) => <label key={field.id}><span>{field.name}<small>{fieldTypeLabels[field.fieldType]}</small></span><div>{renderCell(detailRecord, field)}</div></label>)}</div> : null}
          {recordTab === "comments" ? <div className={styles.recordComments}>{canComment ? <div className={styles.commentComposer}><textarea maxLength={10000} onChange={(event) => setCommentDraft(event.target.value)} placeholder="发表评论，支持团队协作…" value={commentDraft} /><button className={styles.primaryAction} disabled={panelLoading || !commentDraft.trim()} onClick={() => void publishComment()} type="button">发布</button></div> : <p className={styles.panelHint}>当前权限仅可查看评论。</p>}<div className={styles.commentList}>{comments.map((comment) => <article className={comment.status === "resolved" ? styles.commentResolved : undefined} key={comment.id}><header><span className={styles.miniAvatar}>灵</span><div><strong>{comment.authorAccount || "团队成员"}</strong><small>{formatDate(comment.createdAt)}</small></div><em>{comment.status === "resolved" ? "已解决" : "进行中"}</em></header><p>{comment.body}</p>{canWrite ? <footer><button onClick={() => void setCommentStatus(comment, comment.status === "resolved" ? "active" : "resolved")} type="button">{comment.status === "resolved" ? "重新打开" : "标记解决"}</button><button onClick={() => void removeComment(comment)} type="button">删除</button></footer> : null}</article>)}</div>{!panelLoading && !comments.length ? <p className={styles.drawerEmpty}>暂无评论。</p> : null}</div> : null}
          {recordTab === "activity" ? <div className={styles.activityList}>{recordActivities.map((activity) => <article key={activity.id}><span><Clock3 /></span><div><strong>{activity.actorAccount || "系统"} · {activityLabel(activity.action)}</strong><p>{Object.keys(activity.details).length ? JSON.stringify(activity.details) : "无附加信息"}</p><small>{formatDate(activity.createdAt)}</small></div></article>)}{!panelLoading && !recordActivities.length ? <p className={styles.drawerEmpty}>暂无活动记录。</p> : null}</div> : null}
          {recordTab === "attachments" ? <div className={styles.attachmentList}>{canWrite ? <><input className={styles.hiddenInput} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); event.target.value = ""; }} ref={attachmentInputRef} type="file" /><button className={styles.uploadZone} disabled={panelLoading} onClick={() => attachmentInputRef.current?.click()} type="button"><Upload /><strong>上传附件</strong><span>单个文件最大 20MB</span></button></> : null}{recordAttachments.map((attachment) => <article key={attachment.id}><span><FileText /></span><div><a href={attachment.downloadUrl}>{attachment.fileName}</a><small>{formatBytes(attachment.fileSize)} · {attachment.uploadedByAccount || "团队成员"} · {formatDate(attachment.createdAt)}</small></div>{canWrite ? <button aria-label="删除附件" onClick={() => void removeAttachment(attachment)} type="button"><Trash2 /></button> : null}</article>)}</div> : null}
          <footer><p>创建：{detailRecord.createdByAccount || "系统"} · {formatDate(detailRecord.createdAt)}</p><p>更新：{detailRecord.updatedByAccount || "系统"} · {formatDate(detailRecord.updatedAt)}</p>{canWrite ? <button onClick={() => void deleteRecord(detailRecord)} type="button"><Trash2 />删除记录</button> : null}</footer>
        </aside>
      ) : null}

      {panel ? (
        <div className={styles.panelBackdrop} onClick={() => setPanel(null)} role="presentation">
          <aside className={cn(styles.panelDialog, (panel === "field-settings" || panel === "history" || panel === "trash") && styles.panelDialogLarge)} onClick={(event) => event.stopPropagation()}>
            <header><div><span>灵穹知识库</span><h2>{panel === "share" ? "分享与权限" : panel === "comments" ? "评论" : panel === "history" ? "版本历史" : panel === "trash" ? "回收站" : panel === "dashboard" ? "实时仪表盘" : panel === "filter" ? "筛选" : panel === "group" ? "分组" : panel === "sort" ? "排序" : panel === "row-height" ? "行高" : panel === "field-settings" ? "字段配置" : panel === "view-settings" ? "视图配置" : panel === "import-export" ? "导入与导出" : panel === "automation" ? "自动化与工作流" : panel === "notifications" ? "通知与提醒" : panel === "gantt" ? "甘特视图" : panel === "form" ? "表单收集" : "更多设置"}</h2></div><button aria-label="关闭" onClick={() => setPanel(null)} type="button"><X /></button></header>
            {panel === "share" ? <div className={styles.panelBody}>
              <div className={styles.noticeBox}><ShieldCheck /><div><strong>知识空间成员权限</strong><p>所有权限由后端实时校验。所有者可管理成员，编辑者可修改内容，评论者可参与讨论，访客仅可查看。</p></div></div>
              <section className={styles.memberList}>
                <header><strong>空间成员</strong><span>{panelLoading ? "加载中…" : `${members.length} 人`}</span></header>
                {members.map((member) => <article key={member.id}>
                  <span className={styles.miniAvatar}>{(member.account || member.userId).slice(0, 1).toUpperCase()}</span>
                  <div><strong>{member.account || member.userId}</strong><small>{member.userId}</small></div>
                  {member.role === "owner" ? <em>所有者</em> : canManage ? <select aria-label="成员角色" onChange={(event) => void updateMemberRole(member, event.target.value as Exclude<KnowledgeMemberRole, "owner">)} value={member.role}><option value="editor">编辑者</option><option value="commenter">评论者</option><option value="viewer">访客</option></select> : <em>{member.role === "editor" ? "编辑者" : member.role === "commenter" ? "评论者" : "访客"}</em>}
                  {canManage && member.role !== "owner" ? <button aria-label="移除成员" onClick={() => void removeMember(member)} type="button"><X /></button> : null}
                </article>)}
              </section>
              {canManage ? <section className={styles.memberInvite}><strong>添加成员</strong><label>用户 ID<input onChange={(event) => setMemberUserId(event.target.value)} placeholder="输入平台用户 ID" value={memberUserId} /></label><label>显示账号<input onChange={(event) => setMemberAccount(event.target.value)} placeholder="可选，例如 zhangsan" value={memberAccount} /></label><label>角色<select onChange={(event) => setMemberRole(event.target.value as Exclude<KnowledgeMemberRole, "owner">)} value={memberRole}><option value="editor">编辑者</option><option value="commenter">评论者</option><option value="viewer">访客</option></select></label><button className={styles.primaryAction} disabled={panelLoading || !memberUserId.trim()} onClick={() => void createMember()} type="button"><Plus />添加成员</button></section> : null}
              <label>当前链接<input readOnly value={typeof window === "undefined" ? "" : window.location.href} /></label>
              <button onClick={() => void navigator.clipboard.writeText(window.location.href).then(() => setMessage("链接已复制"))} type="button"><Link2 />复制当前链接</button>
            </div> : null}
            {panel === "comments" ? <div className={styles.panelBody}>{commentPath() ? <>{canComment ? <div className={styles.commentComposer}><textarea maxLength={10000} onChange={(event) => setCommentDraft(event.target.value)} placeholder="写下评论或协作建议…" value={commentDraft} /><button className={styles.primaryAction} disabled={panelLoading || !commentDraft.trim()} onClick={() => void publishComment()} type="button">发布评论</button></div> : <p className={styles.panelHint}>当前权限仅可查看评论。</p>}<div className={styles.commentList}>{comments.map((comment) => <article className={comment.status === "resolved" ? styles.commentResolved : undefined} key={comment.id}><header><span className={styles.miniAvatar}>灵</span><div><strong>{comment.authorAccount || "团队成员"}</strong><small>{formatDate(comment.createdAt)}</small></div><em>{comment.status === "resolved" ? "已解决" : "进行中"}</em></header><p>{comment.body}</p>{canWrite ? <footer><button onClick={() => void setCommentStatus(comment, comment.status === "resolved" ? "active" : "resolved")} type="button">{comment.status === "resolved" ? "重新打开" : "标记解决"}</button><button onClick={() => void removeComment(comment)} type="button">删除</button></footer> : null}</article>)}</div>{!panelLoading && !comments.length ? <p className={styles.drawerEmpty}>暂无评论。</p> : null}</> : <EmptyState description="请先打开一个文档或一条多维表记录，再查看评论。" title="选择评论对象" />}</div> : null}
            {panel === "history" ? <div className={styles.historyPanel}><aside>{versions.map((version) => <button className={selectedVersion?.id === version.id ? styles.historyActive : undefined} key={version.id} onClick={() => void inspectVersion(version.id)} type="button"><strong>版本 {version.versionNumber}</strong><span>{version.changeSummary || "内容更新"}</span><small>{version.createdByAccount || "团队成员"} · {formatDate(version.createdAt)}</small></button>)}</aside><section>{selectedVersion ? <><header><div><strong>{selectedVersion.title}</strong><span>页面版本 {selectedVersion.pageRevision}</span></div>{canWrite ? <button className={styles.primaryAction} disabled={panelLoading} onClick={() => void restoreVersion()} type="button"><RefreshCw />恢复此版本</button> : null}</header><div className={styles.versionPreview}>{contentToBlocks(selectedVersion.content).map((block) => <div className={cn(styles.versionBlock, styles[`block_${block.type}`])} key={block.id}>{block.type === "divider" ? <hr /> : block.type === "todo" ? <><CheckSquare />{block.text}</> : block.text || "空白块"}</div>)}</div></> : <EmptyState description="选择左侧版本查看完整内容。" title="版本预览" />}</section></div> : null}
            {panel === "trash" ? <div className={styles.trashList}>
              <header><strong>已删除内容</strong><span>{panelLoading ? "加载中…" : `${trashItems.length} 项`}</span></header>
              {trashItems.map((item) => <article className={styles.trashItem} key={`${item.resourceType}-${item.id}`}>
                <span>{item.resourceType === "page" ? <FileText /> : <Table2 />}</span>
                <div><strong>{item.title}</strong><small>{item.resourceType === "page" ? "文档" : "多维表格"}{item.descendantCount ? ` · 含 ${item.descendantCount} 个子页面` : ""} · {item.deletedByAccount || "团队成员"} · {formatDate(item.deletedAt)}</small></div>
                <div className={styles.trashActions}>{canWrite ? <button disabled={panelLoading} onClick={() => void restoreTrashItem(item)} type="button"><RefreshCw />恢复</button> : null}{canManage ? <button className={styles.trashDelete} disabled={panelLoading} onClick={() => void permanentlyDeleteTrashItem(item)} type="button"><Trash2 />永久删除</button> : null}</div>
              </article>)}
              {!panelLoading && !trashItems.length ? <EmptyState description="移入回收站的文档和多维表格会显示在这里。" title="回收站为空" /> : null}
            </div> : null}
            {panel === "notifications" ? <div className={styles.notificationFeed}><header><strong>最新动态</strong><span>{recordActivities.length + automationRuns.length} 条</span></header>{recordActivities.map((activity) => <article key={activity.id}><span><Clock3 /></span><div><strong>{activity.actorAccount || "系统"} · {activityLabel(activity.action)}</strong><small>{formatDate(activity.createdAt)}</small></div></article>)}{automationRuns.map((run) => <article key={run.id}><span><Zap /></span><div><strong>自动化运行 · {run.status}</strong><small>{formatDate(run.updatedAt)}{run.error ? ` · ${run.error}` : ""}</small></div></article>)}{!panelLoading && !recordActivities.length && !automationRuns.length ? <p className={styles.drawerEmpty}>当前记录与工作流暂无新动态。</p> : null}</div> : null}
            {panel === "dashboard" ? <div className={styles.dashboardPanel}><section><span>记录总数</span><strong>{recordTotal}</strong><small>当前已加载 {records.length} 条</small></section><section><span>字段数量</span><strong>{fields.length}</strong><small>{visibleFields.length} 个字段在当前视图显示</small></section><section><span>最近更新</span><strong>{records.length ? formatDate([...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0].updatedAt) : "—"}</strong><small>{records.length ? "数据实时读取" : "暂无记录"}</small></section><div><header><strong>{distributionField ? `${distributionField.name} 分布` : "记录分布"}</strong><span>{recordDistribution.length} 类</span></header>{recordDistribution.length ? recordDistribution.map(([label, count]) => <div key={label}><span>{label}</span><div><i style={{ width: `${Math.max(4, (count / Math.max(1, records.length)) * 100)}%` }} /></div><strong>{count}</strong></div>) : <p className={styles.drawerEmpty}>添加单选字段后可查看分类分布。</p>}</div></div> : null}
            {panel === "filter" ? <div className={styles.panelBody}><div className={styles.ruleHeader}><span>满足以下</span><select onChange={(event) => setFilterConjunction(event.target.value === "or" ? "or" : "and")} value={filterConjunction}><option value="and">所有条件（且）</option><option value="or">任一条件（或）</option></select></div><div className={styles.ruleList}>{filterConditions.map((condition, index) => <div className={styles.ruleRow} key={`${condition.fieldId}-${index}`}><select aria-label={`筛选字段 ${index + 1}`} onChange={(event) => setFilterConditions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, fieldId: event.target.value } : item))} value={condition.fieldId}><option value="">选择字段</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select><select aria-label={`筛选方式 ${index + 1}`} onChange={(event) => setFilterConditions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item))} value={condition.operator}>{Object.entries(filterOperatorLabels).map(([operator, label]) => <option key={operator} value={operator}>{label}</option>)}</select>{["is_empty", "is_not_empty"].includes(condition.operator) ? <span className={styles.rulePlaceholder}>无需填写值</span> : <input aria-label={`筛选值 ${index + 1}`} onChange={(event) => setFilterConditions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="输入条件值" value={condition.value} />}<button aria-label={`删除筛选条件 ${index + 1}`} onClick={() => setFilterConditions((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><X /></button></div>)}</div><button className={styles.addRuleButton} onClick={() => setFilterConditions((current) => [...current, { fieldId: fields[0]?.id ?? "", operator: "contains", value: "" }])} type="button"><Plus />添加筛选条件</button><button className={styles.primaryAction} onClick={() => void updateSelectedView({ filter: { conjunction: filterConjunction, conditions: filterConditions.filter((condition) => condition.fieldId) } }).then(() => setPanel(null))} type="button">应用并保存到当前视图</button></div> : null}
            {panel === "group" ? <div className={styles.panelBody}><p className={styles.panelHint}>可按多个字段逐级分组，顺序从上到下生效。</p><div className={styles.ruleList}>{groupRules.map((rule, index) => <div className={styles.ruleRowSimple} key={`${rule.fieldId}-${index}`}><span>{index + 1}</span><select aria-label={`分组字段 ${index + 1}`} onChange={(event) => setGroupRules((current) => current.map((item, itemIndex) => itemIndex === index ? { fieldId: event.target.value } : item))} value={rule.fieldId}><option value="">选择字段</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select><button aria-label={`删除分组 ${index + 1}`} onClick={() => setGroupRules((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><X /></button></div>)}</div><button className={styles.addRuleButton} onClick={() => setGroupRules((current) => [...current, { fieldId: fields[0]?.id ?? "" }])} type="button"><Plus />添加分组层级</button><button className={styles.primaryAction} onClick={() => void updateSelectedView({ group: { rules: groupRules.filter((rule) => rule.fieldId) } }).then(() => setPanel(null))} type="button">应用并保存到当前视图</button></div> : null}
            {panel === "sort" ? <div className={styles.panelBody}><p className={styles.panelHint}>支持多级排序；前面的规则优先级更高。</p><div className={styles.ruleList}>{sortRules.map((rule, index) => <div className={styles.ruleRowSimple} key={`${rule.fieldId}-${index}`}><span>{index + 1}</span><select aria-label={`排序字段 ${index + 1}`} onChange={(event) => setSortRules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, fieldId: event.target.value } : item))} value={rule.fieldId}><option value="">选择字段</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select><select aria-label={`排序方向 ${index + 1}`} onChange={(event) => setSortRules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, direction: event.target.value === "desc" ? "desc" : "asc" } : item))} value={rule.direction}><option value="asc">升序</option><option value="desc">降序</option></select><button aria-label={`删除排序 ${index + 1}`} onClick={() => setSortRules((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button"><X /></button></div>)}</div><button className={styles.addRuleButton} onClick={() => setSortRules((current) => [...current, { direction: "asc", fieldId: fields[0]?.id ?? "" }])} type="button"><Plus />添加排序规则</button><button className={styles.primaryAction} onClick={() => void updateSelectedView({ sort: sortRules.filter((rule) => rule.fieldId) }).then(() => setPanel(null))} type="button">应用并保存到当前视图</button></div> : null}
            {panel === "row-height" ? <div className={styles.panelBody}><p className={styles.panelHint}>行高会保存到当前视图，并同步给所有协作者。</p><div className={styles.choiceGrid}>{(["compact", "medium", "tall"] as const).map((height) => <button className={selectedView?.rowHeight === height ? styles.choiceActive : undefined} key={height} onClick={() => void updateSelectedView({ rowHeight: height }).then(() => setPanel(null))} type="button"><Rows3 /><strong>{height === "compact" ? "紧凑" : height === "medium" ? "标准" : "宽松"}</strong></button>)}</div></div> : null}
            {panel === "field-settings" ? <div className={styles.fieldSettings}><div><label className={styles.panelSearch}><Search /><input onChange={(event) => setFieldSearch(event.target.value)} placeholder="搜索字段" value={fieldSearch} /></label><div className={styles.fieldList}>{filteredFields.map((field) => { const visible = !selectedView?.visibleFieldIds.length || selectedView.visibleFieldIds.includes(field.id); return <div key={field.id}><button onClick={() => void toggleFieldVisibility(field.id)} type="button">{visible ? <Eye /> : <EyeOff />}</button><span><ListFilter /><strong>{field.name}</strong><small>{fieldTypeLabels[field.fieldType]}</small></span><button aria-label={`编辑 ${field.name}`} onClick={() => openFieldEditor(field)} type="button"><Settings2 /></button></div>; })}{!filteredFields.length ? <p className={styles.drawerEmpty}>没有匹配的字段。</p> : null}</div><button className={styles.addFieldButton} onClick={() => { setEditingFieldId(""); setCreateTitle(""); setPanel(null); setCreateKind("field"); }} type="button"><Plus />新增字段</button></div><aside><strong>字段类型</strong>{Object.entries(fieldTypeLabels).map(([type, label]) => <button key={type} onClick={() => { setEditingFieldId(""); setCreateTitle(""); setCreateFieldType(type as FieldType); setPanel(null); setCreateKind("field"); }} type="button"><ListFilter />{label}</button>)}</aside></div> : null}
            {panel === "view-settings" ? <div className={styles.panelBody}><div className={styles.noticeBox}><Eye /><div><strong>{selectedView?.name || "当前视图"}</strong><p>显示 {visibleFields.length}/{fields.length} 个字段，{visibleRecords.length} 条记录，行高为 {selectedView?.rowHeight === "compact" ? "紧凑" : selectedView?.rowHeight === "tall" ? "宽松" : "标准"}。</p></div></div><button onClick={() => setPanel("field-settings")} type="button"><Settings2 />配置字段显隐</button><button onClick={() => setPanel("filter")} type="button"><Filter />配置筛选</button><button onClick={() => setPanel("group")} type="button"><Columns3 />配置分组</button><button onClick={() => setPanel("sort")} type="button"><ArrowUpDown />配置排序</button></div> : null}
            {panel === "import-export" ? <div className={styles.panelBody}>{mode === "table" ? <><input accept=".csv,text/csv" className={styles.hiddenInput} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importRecords(file); event.target.value = ""; }} ref={importInputRef} type="file" />{canWrite ? <button onClick={() => importInputRef.current?.click()} type="button"><Upload />导入 CSV<small>最大 20MB / 最多 2 万行</small></button> : null}<button onClick={exportRecords} type="button"><Download />导出当前视图 CSV<small>按当前视图字段、筛选与排序导出</small></button></> : <p className={styles.panelHint}>请先打开一张多维表格。</p>}</div> : null}
            {panel === "automation" ? <div className={styles.automationPanel}><section className={styles.automationCreate}><strong>新建基础规则</strong><input maxLength={255} onChange={(event) => setAutomationName(event.target.value)} placeholder="例如：新增记录后通知制片" value={automationName} /><select onChange={(event) => setAutomationTrigger(event.target.value as AutomationTrigger)} value={automationTrigger}><option value="manual">手动触发</option><option value="record_created">新增记录</option><option value="record_updated">更新记录</option><option value="field_changed">字段变化</option></select><button className={styles.primaryAction} disabled={panelLoading || !automationName.trim()} onClick={() => void createAutomation()} type="button"><Plus />创建规则</button></section><section className={styles.automationRules}>{automations.map((rule) => <article className={selectedAutomationId === rule.id ? styles.automationRuleActive : undefined} key={rule.id} onClick={() => { setSelectedAutomationId(rule.id); void loadAutomationRuns(rule.id); }}><header><div><strong>{rule.name}</strong><span>{rule.triggerType}</span></div><label><input checked={rule.enabled} onChange={() => void toggleAutomation(rule)} onClick={(event) => event.stopPropagation()} type="checkbox" />{rule.enabled ? "已启用" : "已停用"}</label></header><footer><small>更新于 {formatDate(rule.updatedAt)}</small><button disabled={!rule.enabled || panelLoading} onClick={(event) => { event.stopPropagation(); void runAutomation(rule); }} type="button"><Zap />手动运行</button><button aria-label="删除规则" onClick={(event) => { event.stopPropagation(); void removeAutomation(rule); }} type="button"><Trash2 /></button></footer></article>)}{!panelLoading && !automations.length ? <p className={styles.drawerEmpty}>还没有自动化规则。</p> : null}</section><section className={styles.automationRuns}><header><strong>运行日志</strong><span>{automationRuns.length} 次</span></header>{automationRuns.map((run) => <article key={run.id}><span className={cn(styles.runStatus, styles[`run_${run.status}`])}>{run.status}</span><div><strong>{run.recordId ? `记录 ${run.recordId.slice(0, 8)}` : "手动运行"}</strong><small>{formatDate(run.createdAt)}{run.error ? ` · ${run.error}` : ""}</small></div></article>)}{!automationRuns.length ? <p className={styles.drawerEmpty}>选择规则后查看运行日志。</p> : null}</section></div> : null}
            {panel === "gantt" ? <div className={styles.panelBody}><div className={styles.noticeBox}><Rows3 /><div><strong>甘特视图已可用</strong><p>系统使用前两个日期字段作为开始与结束日期；只有一个日期字段时按单日任务展示。</p></div></div><button onClick={() => { const ganttView = views.find((view) => view.viewType === "gantt"); if (ganttView) activateView(ganttView); else { setCreateViewType("gantt"); setCreateKind("view"); } setPanel(null); }} type="button"><Rows3 />打开或新建甘特视图</button></div> : null}
            {panel === "form" ? <div className={styles.panelBody}><div className={styles.noticeBox}><FileText /><div><strong>登录成员表单已可用</strong><p>表单会使用当前字段生成，提交后直接创建真实记录；不生成公开匿名链接。</p></div></div><button onClick={() => { const formView = views.find((view) => view.viewType === "form"); if (formView) activateView(formView); else { setCreateViewType("form"); setCreateKind("view"); } setPanel(null); }} type="button"><FileText />打开或新建表单视图</button></div> : null}
            {panel === "more" ? <div className={styles.panelBody}>{mode === "page" ? <button onClick={() => setPanel("history")} type="button"><Clock3 />版本历史</button> : null}{mode === "table" ? <button onClick={() => setPanel("import-export")} type="button"><Upload />导入与导出</button> : null}<button onClick={() => void refreshCurrent().then(() => setPanel(null))} type="button"><RefreshCw />刷新云端数据</button>{canWrite && mode !== "home" ? <button className={styles.dangerAction} onClick={() => void deleteSelected().then(() => setPanel(null))} type="button"><Trash2 />移入回收站：当前{mode === "page" ? "页面" : "数据表"}</button> : null}<button onClick={() => setPanel("trash")} type="button"><Trash2 />打开回收站</button><p className={styles.panelHint}>删除内容会先移入回收站，可由有权限的成员恢复；只有所有者可永久删除。</p></div> : null}
          </aside>
        </div>
      ) : null}

      {createKind ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <form className={styles.createDialog} onSubmit={(event) => void createResource(event)}>
            <header><div><span>灵穹知识库</span><h2>{createKind === "space" ? "新建知识空间" : createKind === "page" ? "新建文档" : createKind === "table" ? "新建多维表格" : createKind === "field" ? editingFieldId ? "编辑字段" : "新增字段" : "新建视图"}</h2></div><button aria-label="关闭" onClick={() => { setCreateKind(null); setEditingFieldId(""); }} type="button"><X /></button></header>
            <label>名称<input autoFocus maxLength={255} onChange={(event) => setCreateTitle(event.target.value)} placeholder="输入名称" value={createTitle} /></label>
            {createKind === "space" || createKind === "table" ? <label>说明<textarea maxLength={2000} onChange={(event) => setCreateDescription(event.target.value)} placeholder="简要说明用途" value={createDescription} /></label> : null}
            {createKind === "field" ? <><label>字段类型<select disabled={fields.find((field) => field.id === editingFieldId)?.config.primary === true} onChange={(event) => setCreateFieldType(event.target.value as FieldType)} value={createFieldType}>{Object.entries(fieldTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>{["select", "multi_select"].includes(createFieldType) ? <label>选项（用逗号或换行分隔）<textarea onChange={(event) => setCreateFieldOptions(event.target.value)} placeholder="待处理、进行中、已完成" value={createFieldOptions} /></label> : null}{createFieldType === "formula" ? <label>公式表达式<textarea onChange={(event) => setCreateFieldFormula(event.target.value)} placeholder="例如：{单价} * {数量}" value={createFieldFormula} /></label> : null}{["relation", "lookup"].includes(createFieldType) ? <label>关联数据表<select onChange={(event) => setCreateFieldRelationTableId(event.target.value)} value={createFieldRelationTableId || selectedTableId}>{tables.map((table) => <option key={table.id} value={table.id}>{table.title}</option>)}</select></label> : null}<label className={styles.checkboxLabel}><input checked={createFieldRequired} disabled={fields.find((field) => field.id === editingFieldId)?.config.primary === true} onChange={(event) => setCreateFieldRequired(event.target.checked)} type="checkbox" />设为必填字段</label></> : null}
            {createKind === "view" ? <label>视图类型<select onChange={(event) => setCreateViewType(event.target.value as ViewType)} value={createViewType}>{Object.entries(viewTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label> : null}
            <footer><button onClick={() => { setCreateKind(null); setEditingFieldId(""); }} type="button">取消</button><button className={styles.primaryAction} disabled={saving || !createTitle.trim()} type="submit">{saving ? <Loader2 className={styles.spin} /> : editingFieldId ? <Settings2 /> : <Plus />}{editingFieldId ? "保存配置" : "创建"}</button></footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}
