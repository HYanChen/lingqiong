import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase,
  type Database
} from "@/lib/database";
import {
  listModelApiConfigs,
  logModelApiCall,
  ModelApiUsageLimitError,
  releaseModelApiUsage,
  reserveModelApiUsage,
  type ModelApiConfig
} from "@/lib/model-apis";
import {
  beginModelBillingAudit,
  completeModelBillingAudit,
  LingqiongAccountError,
  requireLingqiongModelAccess
} from "@/lib/lingqiong-account";
import {
  getSkillToolForSession,
  SkillAccessError,
  type SkillModule,
  type SkillTool
} from "@/lib/skill-workbench";
import {
  sessionHasAdminPermission,
  type PlatformSessionUser
} from "@/lib/platform-auth";

export type SkillChatAttachment = {
  content: string;
  fileName: string;
  path: string;
  size: number;
  truncated: boolean;
};

export type SkillChatSavedFile = {
  createdAt: string;
  fileName: string;
  fileSize: number;
  id: string;
  path: string;
  source: "generated" | "read" | "manual";
};

export type SkillChatMessage = {
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

export type SkillChatSession = {
  createdAt: string;
  id: string;
  moduleId: string | null;
  moduleTitle: string | null;
  ownerAccount: string | null;
  ownerId: string | null;
  skillId: string;
  skillName: string;
  title: string;
  updatedAt: string;
};

export type SkillChatWorkspace = {
  root: string;
  userRoot: string;
};

export type SkillWorkspaceEntry = {
  kind: "directory" | "file";
  name: string;
  path: string;
  size: number;
  updatedAt: string;
};

export type SendSkillChatInput = {
  filePaths?: string[];
  message?: string;
  moduleId?: string;
  project?: {
    duration?: string;
    focus?: string;
    frame?: string;
    platform?: string;
    projectName?: string;
    sourcePath?: string;
  };
  runOptions?: {
    executionDepth?: string;
    outputFormat?: string;
  };
  saveAs?: string;
  sessionId?: string;
  skillId?: string;
};

type SkillChatSessionRow = {
  created_at: string;
  id: string;
  module_id: string | null;
  module_title: string | null;
  owner_account: string | null;
  owner_id: string | null;
  skill_id: string;
  skill_name: string;
  title: string;
  updated_at: string;
};

type SkillChatMessageRow = {
  attachments_json: string | null;
  content: string;
  created_at: string;
  error: string | null;
  files_json: string | null;
  id: string;
  model: string | null;
  role: string;
  session_id: string;
  status: string;
};

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_HISTORY_MESSAGES = 14;
const saveBlockPattern = /<<<SAVE_FILE:([^>\n]+)>>>\s*([\s\S]*?)\s*<<<END_SAVE_FILE>>>/g;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapSession(row: SkillChatSessionRow): SkillChatSession {
  return {
    createdAt: row.created_at,
    id: row.id,
    moduleId: row.module_id,
    moduleTitle: row.module_title,
    ownerAccount: row.owner_account,
    ownerId: row.owner_id,
    skillId: row.skill_id,
    skillName: row.skill_name,
    title: row.title,
    updatedAt: row.updated_at
  };
}

function mapMessage(row: SkillChatMessageRow): SkillChatMessage {
  return {
    attachments: parseJson<SkillChatAttachment[]>(row.attachments_json, []),
    content: row.content,
    createdAt: row.created_at,
    error: row.error,
    files: parseJson<SkillChatSavedFile[]>(row.files_json, []),
    id: row.id,
    model: row.model,
    role: row.role === "assistant" || row.role === "system" ? row.role : "user",
    sessionId: row.session_id,
    status: row.status === "error" ? "error" : "success"
  };
}

function modelBaseUrl(config: ModelApiConfig) {
  const internalBaseUrl =
    config.provider === "new-api" ? process.env.NEW_API_INTERNAL_BASE_URL?.trim() : "";

  return (internalBaseUrl || config.baseUrl).replace(/\/+$/, "");
}

function completionEndpoint(config: ModelApiConfig) {
  const baseUrl = modelBaseUrl(config);

  if (baseUrl.endsWith("/chat/completions")) {
    return baseUrl;
  }

  if (config.provider === "new-api" && !baseUrl.endsWith("/v1")) {
    return `${baseUrl}/v1/chat/completions`;
  }

  return `${baseUrl}/chat/completions`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function contentToText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (isRecord(item) && typeof item.text === "string") {
          return item.text;
        }

        if (isRecord(item) && typeof item.content === "string") {
          return item.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractModelText(result: unknown) {
  if (!isRecord(result)) {
    return "";
  }

  const choices = Array.isArray(result.choices) ? result.choices : [];
  const firstChoice = choices[0];

  if (isRecord(firstChoice)) {
    const message = firstChoice.message;

    if (isRecord(message)) {
      const content = contentToText(message.content);

      if (content) {
        return content;
      }
    }

    const choiceText = contentToText(firstChoice.text);

    if (choiceText) {
      return choiceText;
    }
  }

  return contentToText(result.output_text);
}

function normalizeSkillApiError(message: string) {
  if (/Authentication Fails|api key.*invalid|invalid/i.test(message)) {
    return "灵穹 API 用户凭证无效，请重新进入用户中心连接账户。";
  }

  if (/quota|insufficient_quota|exceeded/i.test(message)) {
    return "灵穹 API 账户余额不足，请充值后再运行。";
  }

  if (/No available channel|available channel/i.test(message)) {
    return "灵穹 API 没有匹配当前模型的可用渠道。请在 API 网关为当前模型开启渠道。";
  }

  return message;
}

function accountSlug(session: PlatformSessionUser) {
  return (session.id || session.account || "creator")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "creator";
}

export function getSkillChatWorkspace(session: PlatformSessionUser): SkillChatWorkspace {
  const root = path.resolve(
    process.env.WCU_SKILL_WORKSPACE_DIR || path.join(process.cwd(), "data", "skill-workspace")
  );

  return {
    root,
    userRoot: path.join(root, accountSlug(session))
  };
}

function ensureInside(target: string, root: string) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeWorkspaceRelativePath(rawPath: string) {
  const cleaned = rawPath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const normalized = path.posix.normalize(cleaned);

  if (!cleaned || normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error("文件路径必须位于 Skill 工作区内。");
  }

  return normalized;
}

function resolveWorkspacePath(session: PlatformSessionUser, rawPath: string) {
  const workspace = getSkillChatWorkspace(session);
  const requested = rawPath.trim().replace(/\\/g, "/");
  const absolutePath = path.isAbsolute(requested)
    ? path.resolve(requested)
    : path.resolve(workspace.userRoot, normalizeWorkspaceRelativePath(requested));

  if (!ensureInside(absolutePath, workspace.userRoot)) {
    throw new Error("只能访问当前账号的 Skill 工作区文件。");
  }

  return {
    absolutePath,
    relativePath: path.relative(workspace.userRoot, absolutePath).replace(/\\/g, "/"),
    workspace
  };
}

async function readWorkspaceFile(
  session: PlatformSessionUser,
  rawPath: string
): Promise<SkillChatAttachment> {
  const resolved = resolveWorkspacePath(session, rawPath);
  const fileStat = await stat(resolved.absolutePath);

  if (!fileStat.isFile()) {
    throw new Error(`不是可读取文件：${resolved.relativePath}`);
  }

  const buffer = await readFile(resolved.absolutePath);
  const sliced = buffer.subarray(0, MAX_FILE_BYTES);
  const content = sliced.toString("utf8");

  return {
    content,
    fileName: path.basename(resolved.relativePath),
    path: resolved.relativePath,
    size: fileStat.size,
    truncated: buffer.byteLength > MAX_FILE_BYTES
  };
}

export async function readSkillWorkspaceFile(session: PlatformSessionUser, rawPath: string) {
  return readWorkspaceFile(session, rawPath);
}

export async function listSkillWorkspaceEntries(
  session: PlatformSessionUser,
  input: { dir?: string; query?: string } = {}
) {
  const workspace = getSkillChatWorkspace(session);
  await mkdir(workspace.userRoot, { recursive: true });
  const resolved = input.dir?.trim()
    ? resolveWorkspacePath(session, input.dir)
    : {
        absolutePath: workspace.userRoot,
        relativePath: "",
        workspace
      };

  const dirStat = await stat(resolved.absolutePath);

  if (!dirStat.isDirectory()) {
    throw new Error("当前路径不是文件夹。");
  }

  const query = input.query?.trim().toLowerCase();
  const dirents = await readdir(resolved.absolutePath, { withFileTypes: true });
  const entries = await Promise.all(
    dirents
      .filter((entry) => !entry.name.startsWith("."))
      .slice(0, 300)
      .map(async (entry): Promise<SkillWorkspaceEntry> => {
        const absolutePath = path.join(resolved.absolutePath, entry.name);
        const fileStat = await stat(absolutePath);
        const relativePath = path.relative(workspace.userRoot, absolutePath).replace(/\\/g, "/");

        return {
          kind: entry.isDirectory() ? "directory" : "file",
          name: entry.name,
          path: relativePath,
          size: entry.isDirectory() ? 0 : fileStat.size,
          updatedAt: fileStat.mtime.toISOString()
        };
      })
  );

  return entries
    .filter((entry) => !query || entry.path.toLowerCase().includes(query))
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "directory" ? -1 : 1;
      }

      return a.name.localeCompare(b.name, "zh-CN");
    });
}

export async function saveSkillWorkspaceFile(
  session: PlatformSessionUser,
  input: { content: string; path: string }
) {
  return writeWorkspaceFile({
    content: input.content,
    path: input.path,
    session,
    sessionId: "workspace",
    source: "manual"
  });
}

export async function saveSkillWorkspaceBinaryFile(
  session: PlatformSessionUser,
  input: { content: Buffer; path: string }
) {
  return writeWorkspaceFile({
    content: input.content,
    path: input.path,
    session,
    sessionId: "workspace",
    source: "manual"
  });
}

export async function createSkillWorkspaceFolder(session: PlatformSessionUser, rawPath: string) {
  const resolved = resolveWorkspacePath(session, rawPath);
  await mkdir(resolved.absolutePath, { recursive: true });

  return {
    kind: "directory" as const,
    name: path.basename(resolved.relativePath),
    path: resolved.relativePath,
    size: 0,
    updatedAt: new Date().toISOString()
  };
}

export async function deleteSkillWorkspacePath(session: PlatformSessionUser, rawPath: string) {
  const resolved = resolveWorkspacePath(session, rawPath);

  if (!resolved.relativePath) {
    throw new Error("不能删除 Skill 工作区根目录。");
  }

  const fileStat = await stat(resolved.absolutePath);
  const owner = sessionOwnerClause(session);

  await writeDatabase(async (db) => {
    if (!fileStat.isDirectory()) {
      await db.execute(
        `DELETE FROM skill_chat_files WHERE relative_path = ?${owner.sql}`,
        [resolved.relativePath, ...owner.params]
      );
      return;
    }

    const rows = await getRows<{ id: string; relative_path: string }>(
      db,
      `SELECT id, relative_path FROM skill_chat_files WHERE 1 = 1${owner.sql}`,
      owner.params
    );
    const prefix = `${resolved.relativePath}/`;

    for (const row of rows) {
      if (row.relative_path === resolved.relativePath || row.relative_path.startsWith(prefix)) {
        await db.execute("DELETE FROM skill_chat_files WHERE id = ?", [row.id]);
      }
    }
  });

  await rm(resolved.absolutePath, { force: true, recursive: fileStat.isDirectory() });

  return {
    kind: fileStat.isDirectory() ? ("directory" as const) : ("file" as const),
    name: path.basename(resolved.relativePath),
    path: resolved.relativePath,
    size: fileStat.isDirectory() ? 0 : fileStat.size,
    updatedAt: new Date().toISOString()
  };
}

async function writeWorkspaceFile(input: {
  content: Buffer | string;
  messageId?: string;
  path: string;
  session: PlatformSessionUser;
  sessionId: string;
  source: SkillChatSavedFile["source"];
}) {
  const resolved = resolveWorkspacePath(input.session, input.path);
  await mkdir(path.dirname(resolved.absolutePath), { recursive: true });
  await writeFile(resolved.absolutePath, input.content, "utf8");
  const fileStat = await stat(resolved.absolutePath);
  const now = new Date().toISOString();
  const file: SkillChatSavedFile = {
    createdAt: now,
    fileName: path.basename(resolved.relativePath),
    fileSize: fileStat.size,
    id: randomUUID(),
    path: resolved.relativePath,
    source: input.source
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO skill_chat_files (
        id, session_id, message_id, owner_id, owner_account, file_name,
        relative_path, file_size, source, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        file.id,
        input.sessionId,
        input.messageId ?? null,
        input.session.id ?? null,
        input.session.account,
        file.fileName,
        file.path,
        file.fileSize,
        file.source,
        file.createdAt
      ]
    );
  });

  return file;
}

function sessionOwnerClause(session: PlatformSessionUser, alias = "") {
  const prefix = alias ? `${alias}.` : "";

  if (session.id) {
    return {
      params: [session.id, session.account],
      sql: ` AND (${prefix}owner_id = ? OR (${prefix}owner_id IS NULL AND ${prefix}owner_account = ?))`
    };
  }

  return {
    params: [session.account],
    sql: ` AND ${prefix}owner_account = ?`
  };
}

function skillAccessClause(session: PlatformSessionUser, alias = "") {
  const prefix = alias ? `${alias}.` : "";

  if (sessionHasAdminPermission(session, "skills.read")) {
    return { params: [], sql: ` AND ${prefix}active = 1` };
  }

  return {
    params: [session.account],
    sql: ` AND ${prefix}active = 1 AND (${prefix}visibility = 'public' OR ${prefix}owner = ?)`
  };
}

async function findChatSession(db: Database, sessionId: string, session: PlatformSessionUser) {
  const owner = sessionOwnerClause(session, "chat_session");
  const skillAccess = skillAccessClause(session, "skill");
  const row = await getFirstRow<SkillChatSessionRow>(
    db,
    `SELECT chat_session.id, chat_session.skill_id, chat_session.skill_name,
      chat_session.module_id, chat_session.module_title, chat_session.title,
      chat_session.owner_id, chat_session.owner_account, chat_session.created_at,
      chat_session.updated_at
     FROM skill_chat_sessions chat_session
     INNER JOIN skill_tools skill ON skill.id = chat_session.skill_id
     WHERE chat_session.id = ?${owner.sql}${skillAccess.sql}`,
    [sessionId, ...owner.params, ...skillAccess.params]
  );

  return row ? mapSession(row) : null;
}

async function insertChatMessage(db: Database, message: SkillChatMessage) {
  await db.execute(
    `INSERT INTO skill_chat_messages (
      id, session_id, role, content, attachments_json, files_json,
      status, error, model, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.sessionId,
      message.role,
      message.content,
      JSON.stringify(message.attachments),
      JSON.stringify(message.files),
      message.status,
      message.error,
      message.model,
      message.createdAt
    ]
  );
}

async function updateChatMessageFiles(
  db: Database,
  messageId: string,
  files: SkillChatSavedFile[]
) {
  await db.execute("UPDATE skill_chat_messages SET files_json = ? WHERE id = ?", [
    JSON.stringify(files),
    messageId
  ]);
}

async function touchChatSession(db: Database, sessionId: string) {
  await db.execute("UPDATE skill_chat_sessions SET updated_at = ? WHERE id = ?", [
    new Date().toISOString(),
    sessionId
  ]);
}

function pickSkillModule(skill: SkillTool, moduleId?: string): SkillModule {
  return skill.modules.find((item) => item.id === moduleId) ?? skill.modules[0];
}

async function getOrCreateChatSession(input: {
  db: Database;
  message: string;
  module: SkillModule;
  session: PlatformSessionUser;
  sessionId?: string;
  skill: SkillTool;
}) {
  if (input.sessionId) {
    const existing = await findChatSession(input.db, input.sessionId, input.session);

    if (existing) {
      return existing;
    }
  }

  const now = new Date().toISOString();
  const title =
    input.message
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 36) || `${input.skill.displayName} 会话`;
  const chatSession: SkillChatSession = {
    createdAt: now,
    id: randomUUID(),
    moduleId: input.module.id,
    moduleTitle: input.module.title,
    ownerAccount: input.session.account,
    ownerId: input.session.id ?? null,
    skillId: input.skill.id,
    skillName: input.skill.displayName,
    title,
    updatedAt: now
  };

  await input.db.execute(
    `INSERT INTO skill_chat_sessions (
      id, skill_id, skill_name, module_id, module_title, title,
      owner_id, owner_account, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chatSession.id,
      chatSession.skillId,
      chatSession.skillName,
      chatSession.moduleId,
      chatSession.moduleTitle,
      chatSession.title,
      chatSession.ownerId,
      chatSession.ownerAccount,
      chatSession.createdAt,
      chatSession.updatedAt
    ]
  );

  return chatSession;
}

export async function listSkillChatSessions(
  session: PlatformSessionUser,
  options: { limit?: number; skillId?: string } = {}
) {
  return readDatabase(async (db) => {
    const owner = sessionOwnerClause(session, "chat_session");
    const skillAccess = skillAccessClause(session, "skill");
    const skillWhere = options.skillId ? " AND chat_session.skill_id = ?" : "";
    const safeLimit = Math.max(1, Math.min(options.limit ?? 30, 100));
    const rows = await getRows<SkillChatSessionRow>(
      db,
      `SELECT chat_session.id, chat_session.skill_id, chat_session.skill_name,
        chat_session.module_id, chat_session.module_title, chat_session.title,
        chat_session.owner_id, chat_session.owner_account, chat_session.created_at,
        chat_session.updated_at
       FROM skill_chat_sessions chat_session
       INNER JOIN skill_tools skill ON skill.id = chat_session.skill_id
       WHERE 1 = 1${owner.sql}${skillAccess.sql}${skillWhere}
       ORDER BY chat_session.updated_at DESC
       LIMIT ${safeLimit}`,
      [
        ...owner.params,
        ...skillAccess.params,
        ...(options.skillId ? [options.skillId] : [])
      ]
    );

    return rows.map(mapSession);
  });
}

export async function listSkillChatMessages(
  session: PlatformSessionUser,
  sessionId: string,
  options: { limit?: number } = {}
) {
  return readDatabase(async (db) => {
    const chatSession = await findChatSession(db, sessionId, session);

    if (!chatSession) {
      return [];
    }

    const rows = await getRows<SkillChatMessageRow>(
      db,
      `SELECT id, session_id, role, content, attachments_json, files_json,
        status, error, model, created_at
       FROM skill_chat_messages
       WHERE session_id = ?
       ORDER BY created_at ASC
       LIMIT ${Math.max(1, Math.min(options.limit ?? 80, 200))}`,
      [sessionId]
    );

    return rows.map(mapMessage);
  });
}

function buildChatSystemPrompt(skill: SkillTool, skillModule: SkillModule) {
  return [
    "你是战纪宇宙主站内的 Skill 聊天执行器，只通过灵穹 API 响应用户。",
    "你需要像可交付的生产助手一样推进任务，保持中文、结构清晰、直接产出。",
    "不要声称已经访问未提供的文件；只能使用本轮消息中列出的文件内容。",
    "",
    "【当前 Skill】",
    `名称：${skill.displayName}`,
    `触发名：${skill.triggerName}`,
    `分类：${skill.category}`,
    `说明：${skill.description}`,
    "",
    "【当前模块】",
    `${skillModule.order} ${skillModule.title}`,
    skillModule.prompt,
    "",
    "【文件保存能力】",
    "如果你需要把某段内容保存为文件，请输出一个或多个保存块：",
    "<<<SAVE_FILE:outputs/example.md>>>",
    "文件正文",
    "<<<END_SAVE_FILE>>>",
    "保存路径只能写相对路径，建议放在 outputs/、scripts/、assets/ 或 docs/ 下。",
    "普通说明也要保留在回复中，方便用户直接阅读。"
  ].join("\n");
}

function buildChatUserPrompt(input: SendSkillChatInput, attachments: SkillChatAttachment[]) {
  const project = input.project ?? {};
  const runOptions = input.runOptions ?? {};

  return [
    "【本轮用户消息】",
    input.message?.trim() || "请继续推进当前 Skill 任务。",
    "",
    "【项目参数】",
    `项目名：${project.projectName || "未命名项目"}`,
    `平台：${project.platform || "通用"}`,
    `画幅：${project.frame || "不限"}`,
    `目标时长：${project.duration || "未填写"} 分钟`,
    `源文件路径：${project.sourcePath || "未填写"}`,
    `重点约束：${project.focus || "无"}`,
    `执行深度：${runOptions.executionDepth || "完整执行"}`,
    `输出格式：${runOptions.outputFormat || "结构化正文"}`,
    input.saveAs
      ? `用户希望本轮结果自动保存到：${input.saveAs}`
      : "用户未指定自动保存路径。",
    "",
    attachments.length ? "【已读取的工作区文件】" : "【已读取的工作区文件】无",
    attachments
      .map((file) =>
        [
          `--- FILE ${file.path} (${file.size} bytes${file.truncated ? ", 已截断" : ""}) ---`,
          file.content,
          `--- END FILE ${file.path} ---`
        ].join("\n")
      )
      .join("\n\n")
  ].join("\n");
}

function cleanSavedBlocks(text: string) {
  return text.replace(saveBlockPattern, (_match, filePath: string) => `\n\n已生成文件：${filePath.trim()}\n`);
}

function parseManualSaveCommand(message?: string) {
  const match = message?.match(/^\/save\s+([^\n]+)\n([\s\S]+)$/);

  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  return {
    content: match[2].trimEnd(),
    path: match[1].trim()
  };
}

async function saveFilesFromAssistantOutput(input: {
  messageId: string;
  outputText: string;
  saveAs?: string;
  session: PlatformSessionUser;
  sessionId: string;
}) {
  const files: SkillChatSavedFile[] = [];
  const savedPaths = new Set<string>();

  for (const match of input.outputText.matchAll(saveBlockPattern)) {
    const filePath = match[1]?.trim();
    const fileContent = match[2] ?? "";

    if (filePath && !savedPaths.has(filePath)) {
      files.push(
        await writeWorkspaceFile({
          content: fileContent,
          messageId: input.messageId,
          path: filePath,
          session: input.session,
          sessionId: input.sessionId,
          source: "generated"
        })
      );
      savedPaths.add(filePath);
    }
  }

  const saveAsPath = input.saveAs?.trim();

  if (saveAsPath && !savedPaths.has(saveAsPath)) {
    files.push(
      await writeWorkspaceFile({
        content: cleanSavedBlocks(input.outputText).trim() || input.outputText,
        messageId: input.messageId,
        path: saveAsPath,
        session: input.session,
        sessionId: input.sessionId,
        source: "generated"
      })
    );
  }

  return files;
}

async function loadRecentMessages(sessionId: string) {
  return readDatabase(async (db) => {
    const rows = await getRows<SkillChatMessageRow>(
      db,
      `SELECT id, session_id, role, content, attachments_json, files_json,
        status, error, model, created_at
       FROM skill_chat_messages
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ${MAX_HISTORY_MESSAGES}`,
      [sessionId]
    );

    return rows.map(mapMessage).reverse();
  });
}

export async function sendSkillChatMessage(input: SendSkillChatInput, session: PlatformSessionUser) {
  if (!input.skillId) {
    throw new Error("请选择要聊天的 Skill。");
  }

  const messageText = input.message?.trim();

  if (!messageText && !input.filePaths?.length) {
    throw new Error("请输入消息或提供要读取的工作区文件。");
  }

  const skill = await getSkillToolForSession(input.skillId, session);

  if (!skill || !skill.active) {
    throw new SkillAccessError("Skill 不存在、已停用或无权访问。");
  }

  const skillModule = pickSkillModule(skill, input.moduleId);

  if (!skillModule) {
    throw new Error("当前 Skill 没有可聊天的任务模块。");
  }

  const workspace = getSkillChatWorkspace(session);
  await mkdir(workspace.userRoot, { recursive: true });

  const attachments = await Promise.all(
    (input.filePaths ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map((item) => readWorkspaceFile(session, item))
  );

  const chatSession = await writeDatabase(async (db) => {
    const createdSession = await getOrCreateChatSession({
      db,
      message: messageText || "读取文件",
      module: skillModule,
      session,
      sessionId: input.sessionId,
      skill
    });
    const userMessage: SkillChatMessage = {
      attachments,
      content: messageText || "请读取这些文件并继续推进。",
      createdAt: new Date().toISOString(),
      error: null,
      files: [],
      id: randomUUID(),
      model: null,
      role: "user",
      sessionId: createdSession.id,
      status: "success"
    };

    await insertChatMessage(db, userMessage);
    await touchChatSession(db, createdSession.id);

    return createdSession;
  });

  const history = await loadRecentMessages(chatSession.id);
  const manualSave = parseManualSaveCommand(messageText);

  if (manualSave) {
    const assistantMessageId = randomUUID();
    const savedFile = await writeWorkspaceFile({
      content: manualSave.content,
      messageId: assistantMessageId,
      path: manualSave.path,
      session,
      sessionId: chatSession.id,
      source: "manual"
    });
    const assistantMessage: SkillChatMessage = {
      attachments: [],
      content: `已保存文件：${savedFile.path}`,
      createdAt: new Date().toISOString(),
      error: null,
      files: [savedFile],
      id: assistantMessageId,
      model: null,
      role: "assistant",
      sessionId: chatSession.id,
      status: "success"
    };

    await writeDatabase(async (db) => {
      await insertChatMessage(db, assistantMessage);
      await touchChatSession(db, chatSession.id);
    });

    return {
      message: assistantMessage,
      messages: await listSkillChatMessages(session, chatSession.id),
      session: chatSession,
      workspace
    };
  }

  const configs = await listModelApiConfigs();
  const config = configs.find((item) => item.enabled && item.provider === "new-api") ?? null;
  const modelInput = buildChatUserPrompt(input, attachments);

  if (!config) {
    throw new Error("Skill 聊天只允许直接调用灵穹 API，请联系平台运营人员完成 API 网关配置。");
  }

  const access = await requireLingqiongModelAccess(session);
  const actor = {
    account: session.account,
    id: session.id,
    role: session.adminRole ?? session.role
  };
  const billingAudit = await beginModelBillingAudit({
    access,
    capability: "skills.chat",
    model: config.model
  });
  let reservation;

  try {
    reservation = await reserveModelApiUsage(config.id, actor);
  } catch (error) {
    await completeModelBillingAudit(billingAudit.id, {
      errorCode:
        error instanceof ModelApiUsageLimitError
          ? error.code
          : "MODEL_USAGE_GUARD_UNAVAILABLE",
      newApiUserId: access.account.id,
      status: "failed"
    }).catch((auditError) => {
      console.error("Failed to complete Skill chat billing audit", auditError);
    });
    throw error;
  }

  let billingStatus: "failed" | "succeeded" = "failed";
  let billingErrorCode: string | undefined = "SKILL_CHAT_REQUEST_FAILED";

  try {
    const response = await fetch(completionEndpoint(config), {
      body: JSON.stringify({
        max_tokens: config.maxTokens,
        messages: [
          { content: config.systemPrompt, role: "system" },
          { content: buildChatSystemPrompt(skill, skillModule), role: "system" },
          ...history
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({
              content: item.content,
              role: item.role
            })),
          { content: modelInput, role: "user" }
        ],
        model: config.model,
        temperature: config.temperature
      }),
      headers: {
        Authorization: `Bearer ${access.apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const rawMessage =
        typeof result?.error?.message === "string"
          ? result.error.message
          : `灵穹 API 请求失败：${response.status}`;
      const message = normalizeSkillApiError(rawMessage);

      await writeDatabase(async (db) => {
        await insertChatMessage(db, {
          attachments: [],
          content: message,
          createdAt: new Date().toISOString(),
          error: message,
          files: [],
          id: randomUUID(),
          model: config.model,
          role: "assistant",
          sessionId: chatSession.id,
          status: "error"
        });
        await touchChatSession(db, chatSession.id);
      });
      await logModelApiCall({
        actor,
        configId: config.id,
        error: message,
        nodeTitle: `Skill Chat: ${skill.displayName}`,
        prompt: modelInput,
        status: "error"
      });

      billingErrorCode = "SKILL_CHAT_UPSTREAM_ERROR";

      if (/quota|insufficient|余额不足|额度不足|exceeded/iu.test(rawMessage)) {
        billingErrorCode = "API_BALANCE_REQUIRED";
        throw new LingqiongAccountError(
          "API_BALANCE_REQUIRED",
          "灵穹 API 账户余额不足，请充值后再继续聊天。",
          402
        );
      }

      throw new Error(message);
    }

    const outputText = extractModelText(result) || "模型返回为空。";
    billingStatus = "succeeded";
    billingErrorCode = undefined;
    const assistantMessageId = randomUUID();
    const savedFiles = await saveFilesFromAssistantOutput({
      messageId: assistantMessageId,
      outputText,
      saveAs: input.saveAs,
      session,
      sessionId: chatSession.id
    });
    const assistantMessage: SkillChatMessage = {
      attachments: [],
      content: cleanSavedBlocks(outputText).trim() || outputText,
      createdAt: new Date().toISOString(),
      error: null,
      files: savedFiles,
      id: assistantMessageId,
      model: config.model,
      role: "assistant",
      sessionId: chatSession.id,
      status: "success"
    };

    await writeDatabase(async (db) => {
      await insertChatMessage(db, assistantMessage);
      await updateChatMessageFiles(db, assistantMessage.id, savedFiles);
      await touchChatSession(db, chatSession.id);
    });
    await logModelApiCall({
      actor,
      configId: config.id,
      nodeTitle: `Skill Chat: ${skill.displayName}`,
      prompt: modelInput,
      responseText: outputText,
      status: "success"
    });

    return {
      message: assistantMessage,
      session: chatSession,
      workspace,
      messages: await listSkillChatMessages(session, chatSession.id)
    };
  } catch (error) {
    if (
      error instanceof LingqiongAccountError ||
      error instanceof ModelApiUsageLimitError
    ) {
      throw error;
    }

    if (error instanceof Error) {
      throw new Error(normalizeSkillApiError(error.message));
    }

    throw new Error("Skill 聊天失败。");
  } finally {
    await releaseModelApiUsage(reservation.id).catch((error) => {
      console.error("Failed to release Skill chat concurrency lease", error);
    });
    await completeModelBillingAudit(billingAudit.id, {
      errorCode: billingErrorCode,
      newApiUserId: access.account.id,
      status: billingStatus
    }).catch((error) => {
      console.error("Failed to complete Skill chat billing audit", error);
    });
  }
}
