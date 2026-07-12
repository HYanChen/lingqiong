import { randomUUID } from "node:crypto";

import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase,
  type Database,
  type SqlValue
} from "@/lib/database";

export const episodeStatuses = ["draft", "ready", "locked", "archived"] as const;
export const elementKinds = ["role", "scene", "prop"] as const;
export const productionStatuses = [
  "draft",
  "ready",
  "queued",
  "generating",
  "rendering",
  "completed",
  "failed",
  "archived"
] as const;
export const generationJobStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled"
] as const;
export const generationResourceTypes = [
  "episode",
  "element",
  "storyboard",
  "voiceover",
  "composition"
] as const;
export const generationTaskTypes = [
  "script_analysis",
  "element_image",
  "storyboard_image",
  "storyboard_video",
  "voiceover_audio",
  "composition_export"
] as const;

export type EpisodeStatus = (typeof episodeStatuses)[number];
export type ElementKind = (typeof elementKinds)[number];
export type ProductionStatus = (typeof productionStatuses)[number];
export type GenerationJobStatus = (typeof generationJobStatuses)[number];
export type GenerationResourceType = (typeof generationResourceTypes)[number];
export type GenerationTaskType = (typeof generationTaskTypes)[number];

export type Episode = {
  createdAt: string;
  episodeNumber: number;
  id: string;
  projectId: string;
  script: string;
  sortOrder: number;
  status: EpisodeStatus;
  summary: string;
  title: string;
  updatedAt: string;
};

export type ProductionElement = {
  aliases: string[];
  createdAt: string;
  description: string;
  episodeId?: string;
  id: string;
  kind: ElementKind;
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

export type Storyboard = {
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

export type Voiceover = {
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

export type Composition = {
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

export type GenerationJob = {
  attemptCount: number;
  createdAt: string;
  createdByAccount?: string;
  createdById?: string;
  episodeId?: string;
  error?: string;
  id: string;
  input: Record<string, unknown>;
  modelConfigId?: string;
  output?: Record<string, unknown>;
  projectId: string;
  resourceId: string;
  resourceType: GenerationResourceType;
  status: GenerationJobStatus;
  taskType: GenerationTaskType;
  updatedAt: string;
};

type EpisodeRow = {
  created_at: string;
  episode_number: number;
  id: string;
  project_id: string;
  script: string;
  sort_order: number;
  status: string;
  summary: string;
  title: string;
  updated_at: string;
};

type ElementRow = {
  aliases_json: string;
  created_at: string;
  description: string;
  episode_id: string | null;
  id: string;
  kind: string;
  name: string;
  notes: string;
  project_id: string;
  prompt: string;
  reference_image_url: string | null;
  sort_order: number;
  status: string;
  updated_at: string;
  voice_profile_id: string | null;
};

type StoryboardRow = {
  camera: string;
  created_at: string;
  dialogue: string;
  duration_ms: number;
  element_ids_json: string;
  episode_id: string;
  id: string;
  image_url: string | null;
  negative_prompt: string;
  project_id: string;
  prompt: string;
  reference_image_url: string | null;
  shot_number: number;
  sort_order: number;
  status: string;
  title: string;
  updated_at: string;
  video_url: string | null;
};

type VoiceoverRow = {
  audio_url: string | null;
  created_at: string;
  duration_ms: number;
  episode_id: string;
  id: string;
  line_text: string;
  project_id: string;
  role_element_id: string | null;
  sort_order: number;
  speaker_name: string;
  status: string;
  storyboard_id: string | null;
  updated_at: string;
  voice_profile_id: string | null;
};

type CompositionRow = {
  created_at: string;
  episode_id: string;
  id: string;
  output_url: string | null;
  project_id: string;
  revision: number;
  settings_json: string;
  status: string;
  timeline_json: string;
  updated_at: string;
};

type GenerationJobRow = {
  attempt_count: number;
  created_at: string;
  created_by_account: string | null;
  created_by_id: string | null;
  episode_id: string | null;
  error: string | null;
  id: string;
  input_json: string;
  model_config_id: string | null;
  output_json: string | null;
  project_id: string;
  resource_id: string;
  resource_type: string;
  status: string;
  task_type: string;
  updated_at: string;
};

export class ProductionPipelineError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;

  constructor(
    code: string,
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ProductionPipelineError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function fail(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): never {
  throw new ProductionPipelineError(code, message, status, details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown) {
  if (!isRecord(value)) {
    fail("INVALID_INPUT", "请求内容必须是 JSON 对象。");
  }

  return value;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function byteLength(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function normalizedText(
  value: unknown,
  options: {
    fallback?: string;
    field: string;
    max: number;
    maxChars?: number;
    required?: boolean;
  }
) {
  if (value === undefined) {
    const fallback = options.fallback ?? "";

    if (options.required && !fallback.trim()) {
      fail("INVALID_INPUT", `${options.field}不能为空。`);
    }

    return fallback;
  }

  if (typeof value !== "string") {
    fail("INVALID_INPUT", `${options.field}必须是文本。`);
  }

  const normalized = value.trim();

  if (options.required && !normalized) {
    fail("INVALID_INPUT", `${options.field}不能为空。`);
  }

  if (options.maxChars && normalized.length > options.maxChars) {
    fail("INPUT_TOO_LARGE", `${options.field}内容过长。`, 413);
  }

  if (Buffer.byteLength(normalized, "utf8") > options.max) {
    fail("INPUT_TOO_LARGE", `${options.field}内容过长。`, 413);
  }

  return normalized;
}

function normalizedOptionalText(
  value: unknown,
  options: {
    fallback?: string;
    field: string;
    max: number;
    maxChars?: number;
  }
) {
  if (value === undefined) {
    return options.fallback;
  }

  if (value === null || value === "") {
    return undefined;
  }

  return normalizedText(value, {
    field: options.field,
    max: options.max,
    maxChars: options.maxChars,
    required: true
  });
}

function normalizedMediaUrl(
  value: unknown,
  options: { fallback?: string; field: string }
) {
  const normalized = normalizedOptionalText(value, {
    fallback: options.fallback,
    field: options.field,
    max: 8192,
    maxChars: 2048
  });

  if (!normalized) {
    return undefined;
  }

  if (/\s|\\/.test(normalized)) {
    fail("INVALID_URL", `${options.field}只支持 http、https 或站内路径。`);
  }

  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) {
      fail("INVALID_URL", `${options.field}不能使用协议相对地址。`);
    }

    return normalized;
  }

  try {
    const url = new URL(normalized);

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      fail("INVALID_URL", `${options.field}只支持 http、https 或站内路径。`);
    }
  } catch (error) {
    if (error instanceof ProductionPipelineError) {
      throw error;
    }

    fail("INVALID_URL", `${options.field}只支持 http、https 或站内路径。`);
  }

  return normalized;
}

function normalizedInteger(
  value: unknown,
  options: {
    fallback: number;
    field: string;
    max: number;
    min: number;
  }
) {
  const candidate = value === undefined ? options.fallback : value;

  if (
    typeof candidate !== "number" ||
    !Number.isInteger(candidate) ||
    candidate < options.min ||
    candidate > options.max
  ) {
    fail(
      "INVALID_INPUT",
      `${options.field}必须是 ${options.min} 到 ${options.max} 之间的整数。`
    );
  }

  return candidate;
}

function normalizedEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  options: { fallback: T; field: string }
) {
  const candidate = value === undefined ? options.fallback : value;

  if (typeof candidate !== "string" || !allowed.includes(candidate as T)) {
    fail("INVALID_INPUT", `${options.field}取值不正确。`, 400, {
      allowed: [...allowed]
    });
  }

  return candidate as T;
}

function normalizedId(value: unknown, field: string): string;
function normalizedId(
  value: unknown,
  field: string,
  options: { optional: true }
): string | undefined;
function normalizedId(
  value: unknown,
  field: string,
  options: { optional?: boolean } = {}
): string | undefined {
  if (options.optional && (value === undefined || value === null || value === "")) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim() || value.length > 191) {
    fail("INVALID_INPUT", `${field}格式不正确。`);
  }

  return value.trim();
}

function normalizedStringList(
  value: unknown,
  options: {
    fallback?: string[];
    field: string;
    itemMax: number;
    maxItems: number;
  }
) {
  if (value === undefined) {
    return options.fallback ?? [];
  }

  if (!Array.isArray(value) || value.length > options.maxItems) {
    fail("INVALID_INPUT", `${options.field}格式不正确。`);
  }

  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      fail("INVALID_INPUT", `${options.field}只能包含文本。`);
    }

    const normalized = item.trim();

    if (!normalized) {
      continue;
    }

    if (Buffer.byteLength(normalized, "utf8") > options.itemMax) {
      fail("INPUT_TOO_LARGE", `${options.field}中的单项内容过长。`, 413);
    }

    if (!result.includes(normalized)) {
      result.push(normalized);
    }
  }

  return result;
}

function mapEpisode(row: EpisodeRow): Episode {
  return {
    createdAt: row.created_at,
    episodeNumber: Number(row.episode_number),
    id: row.id,
    projectId: row.project_id,
    script: row.script,
    sortOrder: Number(row.sort_order),
    status: normalizedEnum(row.status, episodeStatuses, {
      fallback: "draft",
      field: "剧集状态"
    }),
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at
  };
}

function mapElement(row: ElementRow): ProductionElement {
  return {
    aliases: normalizedStringList(parseJson<unknown>(row.aliases_json, []), {
      field: "别名",
      itemMax: 300,
      maxItems: 30
    }),
    createdAt: row.created_at,
    description: row.description,
    episodeId: row.episode_id ?? undefined,
    id: row.id,
    kind: normalizedEnum(row.kind, elementKinds, {
      fallback: "role",
      field: "元素类型"
    }),
    name: row.name,
    notes: row.notes,
    projectId: row.project_id,
    prompt: row.prompt,
    referenceImageUrl: row.reference_image_url ?? undefined,
    sortOrder: Number(row.sort_order),
    status: normalizedEnum(row.status, productionStatuses, {
      fallback: "draft",
      field: "元素状态"
    }),
    updatedAt: row.updated_at,
    voiceProfileId: row.voice_profile_id ?? undefined
  };
}

function mapStoryboard(row: StoryboardRow): Storyboard {
  return {
    camera: row.camera,
    createdAt: row.created_at,
    dialogue: row.dialogue,
    durationMs: Number(row.duration_ms),
    elementIds: normalizedStringList(parseJson<unknown>(row.element_ids_json, []), {
      field: "元素引用",
      itemMax: 191,
      maxItems: 100
    }),
    episodeId: row.episode_id,
    id: row.id,
    imageUrl: row.image_url ?? undefined,
    negativePrompt: row.negative_prompt,
    projectId: row.project_id,
    prompt: row.prompt,
    referenceImageUrl: row.reference_image_url ?? undefined,
    shotNumber: Number(row.shot_number),
    sortOrder: Number(row.sort_order),
    status: normalizedEnum(row.status, productionStatuses, {
      fallback: "draft",
      field: "分镜状态"
    }),
    title: row.title,
    updatedAt: row.updated_at,
    videoUrl: row.video_url ?? undefined
  };
}

function mapVoiceover(row: VoiceoverRow): Voiceover {
  return {
    audioUrl: row.audio_url ?? undefined,
    createdAt: row.created_at,
    durationMs: Number(row.duration_ms),
    episodeId: row.episode_id,
    id: row.id,
    lineText: row.line_text,
    projectId: row.project_id,
    roleElementId: row.role_element_id ?? undefined,
    sortOrder: Number(row.sort_order),
    speakerName: row.speaker_name,
    status: normalizedEnum(row.status, productionStatuses, {
      fallback: "draft",
      field: "配音状态"
    }),
    storyboardId: row.storyboard_id ?? undefined,
    updatedAt: row.updated_at,
    voiceProfileId: row.voice_profile_id ?? undefined
  };
}

function mapComposition(row: CompositionRow): Composition {
  const settings = parseJson<unknown>(row.settings_json, {});
  const timeline = parseJson<unknown>(row.timeline_json, []);

  return {
    createdAt: row.created_at,
    episodeId: row.episode_id,
    id: row.id,
    outputUrl: row.output_url ?? undefined,
    projectId: row.project_id,
    revision: Number(row.revision),
    settings: isRecord(settings) ? settings : {},
    status: normalizedEnum(row.status, productionStatuses, {
      fallback: "draft",
      field: "合成状态"
    }),
    timeline: Array.isArray(timeline) ? timeline : [],
    updatedAt: row.updated_at
  };
}

function mapGenerationJob(row: GenerationJobRow): GenerationJob {
  const input = parseJson<unknown>(row.input_json, {});
  const output = row.output_json ? parseJson<unknown>(row.output_json, {}) : undefined;

  return {
    attemptCount: Number(row.attempt_count),
    createdAt: row.created_at,
    createdByAccount: row.created_by_account ?? undefined,
    createdById: row.created_by_id ?? undefined,
    episodeId: row.episode_id ?? undefined,
    error: row.error ?? undefined,
    id: row.id,
    input: isRecord(input) ? input : {},
    modelConfigId: row.model_config_id ?? undefined,
    output: output && isRecord(output) ? output : undefined,
    projectId: row.project_id,
    resourceId: row.resource_id,
    resourceType: normalizedEnum(row.resource_type, generationResourceTypes, {
      fallback: "episode",
      field: "任务资源类型"
    }),
    status: normalizedEnum(row.status, generationJobStatuses, {
      fallback: "queued",
      field: "任务状态"
    }),
    taskType: normalizedEnum(row.task_type, generationTaskTypes, {
      fallback: "script_analysis",
      field: "任务类型"
    }),
    updatedAt: row.updated_at
  };
}

async function episodeRow(db: Database, projectId: string, episodeId: string) {
  return getFirstRow<EpisodeRow>(
    db,
    `SELECT id, project_id, episode_number, title, summary, script, status,
      sort_order, created_at, updated_at
     FROM episodes
     WHERE project_id = ? AND id = ?`,
    [projectId, episodeId]
  );
}

async function elementRow(db: Database, projectId: string, elementId: string) {
  return getFirstRow<ElementRow>(
    db,
    `SELECT id, project_id, episode_id, kind, name, aliases_json, prompt,
      description, notes, reference_image_url, voice_profile_id, status,
      sort_order, created_at, updated_at
     FROM elements
     WHERE project_id = ? AND id = ?`,
    [projectId, elementId]
  );
}

async function storyboardRow(db: Database, projectId: string, storyboardId: string) {
  return getFirstRow<StoryboardRow>(
    db,
    `SELECT id, project_id, episode_id, shot_number, title, prompt,
      negative_prompt, dialogue, camera, duration_ms, element_ids_json,
      reference_image_url, image_url, video_url, status, sort_order,
      created_at, updated_at
     FROM storyboards
     WHERE project_id = ? AND id = ?`,
    [projectId, storyboardId]
  );
}

async function voiceoverRow(db: Database, projectId: string, voiceoverId: string) {
  return getFirstRow<VoiceoverRow>(
    db,
    `SELECT id, project_id, episode_id, storyboard_id, role_element_id,
      line_text, speaker_name, voice_profile_id, audio_url, duration_ms,
      status, sort_order, created_at, updated_at
     FROM voiceovers
     WHERE project_id = ? AND id = ?`,
    [projectId, voiceoverId]
  );
}

async function compositionRow(db: Database, projectId: string, episodeId: string) {
  return getFirstRow<CompositionRow>(
    db,
    `SELECT id, project_id, episode_id, timeline_json, settings_json,
      output_url, status, revision, created_at, updated_at
     FROM compositions
     WHERE project_id = ? AND episode_id = ?`,
    [projectId, episodeId]
  );
}

async function compositionByIdRow(
  db: Database,
  projectId: string,
  compositionId: string
) {
  return getFirstRow<CompositionRow>(
    db,
    `SELECT id, project_id, episode_id, timeline_json, settings_json,
      output_url, status, revision, created_at, updated_at
     FROM compositions
     WHERE project_id = ? AND id = ?`,
    [projectId, compositionId]
  );
}

/**
 * Serialize all production writes for one project and keep them from racing a
 * project deletion. The route-level ownership check is still authoritative;
 * this lock only protects database integrity after that check has completed.
 */
async function requireLockedProject(db: Database, projectId: string) {
  const project = await getFirstRow<{ id: string }>(
    db,
    "SELECT id FROM projects WHERE id = ? FOR UPDATE",
    [projectId]
  );

  if (!project) {
    fail("PROJECT_NOT_FOUND", "项目不存在。", 404);
  }

  return project;
}

async function requireEpisodeRow(db: Database, projectId: string, episodeId: string) {
  const row = await episodeRow(db, projectId, normalizedId(episodeId, "剧集 ID"));

  if (!row) {
    fail("EPISODE_NOT_FOUND", "剧集不存在或不属于当前项目。", 404);
  }

  return row;
}

async function validateElementIds(
  db: Database,
  projectId: string,
  episodeId: string,
  ids: string[]
) {
  if (!ids.length) {
    return;
  }

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await getRows<{ episode_id: string | null; id: string }>(
    db,
    `SELECT id, episode_id
     FROM elements
     WHERE project_id = ? AND id IN (${placeholders})`,
    [projectId, ...ids]
  );

  if (rows.length !== ids.length) {
    fail("INVALID_ELEMENT_REFERENCE", "分镜引用了不存在或不属于当前项目的元素。", 400);
  }

  if (rows.some((row) => row.episode_id && row.episode_id !== episodeId)) {
    fail("INVALID_ELEMENT_REFERENCE", "分镜不能引用其他剧集的专属元素。", 400);
  }
}

async function validateElementMutation(
  db: Database,
  current: ElementRow,
  next: ElementRow
) {
  const scopeChanged = current.episode_id !== next.episode_id;
  const roleKindRemoved = current.kind === "role" && next.kind !== "role";

  if (!scopeChanged && !roleKindRemoved) {
    return;
  }

  const boardCandidates = await getRows<{
    element_ids_json: string;
    episode_id: string;
    id: string;
  }>(
    db,
    `SELECT id, episode_id, element_ids_json
     FROM storyboards
     WHERE project_id = ? AND element_ids_json LIKE ?`,
    [current.project_id, `%${current.id}%`]
  );
  const linkedBoards = boardCandidates.filter((board) => {
    const ids = parseJson<unknown>(board.element_ids_json, []);
    return Array.isArray(ids) && ids.includes(current.id);
  });

  if (
    next.episode_id &&
    linkedBoards.some((board) => board.episode_id !== next.episode_id)
  ) {
    fail(
      "RESOURCE_CONFLICT",
      "该元素已被其他剧集的分镜引用，不能直接修改所属剧集。",
      409
    );
  }

  const linkedVoiceovers = await getRows<{ episode_id: string; id: string }>(
    db,
    `SELECT id, episode_id FROM voiceovers
     WHERE project_id = ? AND role_element_id = ?`,
    [current.project_id, current.id]
  );

  if (roleKindRemoved && linkedVoiceovers.length) {
    fail(
      "RESOURCE_CONFLICT",
      "该角色仍被配音引用，不能直接改为其他元素类型。",
      409
    );
  }

  if (
    next.episode_id &&
    linkedVoiceovers.some((voiceover) => voiceover.episode_id !== next.episode_id)
  ) {
    fail(
      "RESOURCE_CONFLICT",
      "该角色已被其他剧集的配音引用，不能直接修改所属剧集。",
      409
    );
  }
}

function translateWriteError(error: unknown, conflictMessage: string): never {
  const code = (error as { code?: string }).code;

  if (code === "ER_DUP_ENTRY") {
    fail("RESOURCE_CONFLICT", conflictMessage, 409);
  }

  if (code === "ER_DATA_TOO_LONG") {
    fail("INPUT_TOO_LARGE", "提交内容超过存储限制。", 413);
  }

  throw error;
}

export async function listEpisodes(projectId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");

  return readDatabase(async (db) =>
    (
      await getRows<EpisodeRow>(
        db,
        `SELECT id, project_id, episode_number, title, summary, script, status,
          sort_order, created_at, updated_at
         FROM episodes
         WHERE project_id = ?
         ORDER BY sort_order ASC, episode_number ASC, created_at ASC, id ASC`,
        [safeProjectId]
      )
    ).map(mapEpisode)
  );
}

export async function getEpisode(projectId: string, episodeId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeEpisodeId = normalizedId(episodeId, "剧集 ID");

  return readDatabase(async (db) => {
    const row = await episodeRow(db, safeProjectId, safeEpisodeId);
    return row ? mapEpisode(row) : null;
  });
}

export async function createEpisode(projectId: string, input: unknown) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const raw = requireRecord(input);

  try {
    return await writeDatabase(async (db) => {
      await requireLockedProject(db, safeProjectId);
      const maxRow = await getFirstRow<{ max_number: number | null }>(
        db,
        "SELECT MAX(episode_number) AS max_number FROM episodes WHERE project_id = ?",
        [safeProjectId]
      );
      const defaultNumber = Number(maxRow?.max_number ?? 0) + 1;
      const episodeNumber = normalizedInteger(raw.episodeNumber, {
        fallback: defaultNumber,
        field: "剧集序号",
        max: 100000,
        min: 1
      });
      const now = new Date().toISOString();
      const row: EpisodeRow = {
        created_at: now,
        episode_number: episodeNumber,
        id: randomUUID(),
        project_id: safeProjectId,
        script: normalizedText(raw.script, {
          fallback: "",
          field: "剧本",
          max: 1024 * 1024
        }),
        sort_order: normalizedInteger(raw.sortOrder, {
          fallback: episodeNumber,
          field: "排序值",
          max: 100000,
          min: -100000
        }),
        status: normalizedEnum(raw.status, episodeStatuses, {
          fallback: "draft",
          field: "剧集状态"
        }),
        summary: normalizedText(raw.summary, {
          fallback: "",
          field: "剧集摘要",
          max: 100000
        }),
        title: normalizedText(raw.title, {
          fallback: `第${episodeNumber}集`,
          field: "剧集标题",
          max: 1000,
          maxChars: 255,
          required: true
        }),
        updated_at: now
      };

      await db.execute(
        `INSERT INTO episodes (
          id, project_id, episode_number, title, summary, script, status,
          sort_order, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.project_id,
          row.episode_number,
          row.title,
          row.summary,
          row.script,
          row.status,
          row.sort_order,
          row.created_at,
          row.updated_at
        ]
      );

      return mapEpisode(row);
    });
  } catch (error) {
    translateWriteError(error, "当前项目已存在相同序号的剧集。");
  }
}

export async function updateEpisode(projectId: string, episodeId: string, input: unknown) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeEpisodeId = normalizedId(episodeId, "剧集 ID");
  const raw = requireRecord(input);

  try {
    return await writeDatabase(async (db) => {
      await requireLockedProject(db, safeProjectId);
      const currentRow = await episodeRow(db, safeProjectId, safeEpisodeId);

      if (!currentRow) {
        return null;
      }

      const episodeNumber = normalizedInteger(raw.episodeNumber, {
        fallback: Number(currentRow.episode_number),
        field: "剧集序号",
        max: 100000,
        min: 1
      });
      const conflict = await getFirstRow<{ id: string }>(
        db,
        `SELECT id FROM episodes
         WHERE project_id = ? AND episode_number = ? AND id <> ?`,
        [safeProjectId, episodeNumber, safeEpisodeId]
      );

      if (conflict) {
        fail("RESOURCE_CONFLICT", "当前项目已存在相同序号的剧集。", 409);
      }

      const nextRow: EpisodeRow = {
        ...currentRow,
        episode_number: episodeNumber,
        script: normalizedText(raw.script, {
          fallback: currentRow.script,
          field: "剧本",
          max: 1024 * 1024
        }),
        sort_order: normalizedInteger(raw.sortOrder, {
          fallback: Number(currentRow.sort_order),
          field: "排序值",
          max: 100000,
          min: -100000
        }),
        status: normalizedEnum(raw.status, episodeStatuses, {
          fallback: currentRow.status as EpisodeStatus,
          field: "剧集状态"
        }),
        summary: normalizedText(raw.summary, {
          fallback: currentRow.summary,
          field: "剧集摘要",
          max: 100000
        }),
        title: normalizedText(raw.title, {
          fallback: currentRow.title,
          field: "剧集标题",
          max: 1000,
          maxChars: 255,
          required: true
        }),
        updated_at: new Date().toISOString()
      };

      await db.execute(
        `UPDATE episodes
         SET episode_number = ?, title = ?, summary = ?, script = ?, status = ?,
           sort_order = ?, updated_at = ?
         WHERE project_id = ? AND id = ?`,
        [
          nextRow.episode_number,
          nextRow.title,
          nextRow.summary,
          nextRow.script,
          nextRow.status,
          nextRow.sort_order,
          nextRow.updated_at,
          safeProjectId,
          safeEpisodeId
        ]
      );

      return mapEpisode(nextRow);
    });
  } catch (error) {
    translateWriteError(error, "当前项目已存在相同序号的剧集。");
  }
}

export async function deleteEpisode(projectId: string, episodeId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeEpisodeId = normalizedId(episodeId, "剧集 ID");

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const current = await episodeRow(db, safeProjectId, safeEpisodeId);

    if (!current) {
      return false;
    }

    await db.execute(
      "DELETE FROM generation_jobs WHERE project_id = ? AND episode_id = ?",
      [safeProjectId, safeEpisodeId]
    );
    await db.execute(
      "DELETE FROM voiceovers WHERE project_id = ? AND episode_id = ?",
      [safeProjectId, safeEpisodeId]
    );
    await db.execute(
      "DELETE FROM storyboards WHERE project_id = ? AND episode_id = ?",
      [safeProjectId, safeEpisodeId]
    );
    await db.execute(
      "DELETE FROM compositions WHERE project_id = ? AND episode_id = ?",
      [safeProjectId, safeEpisodeId]
    );
    await db.execute(
      "DELETE FROM elements WHERE project_id = ? AND episode_id = ?",
      [safeProjectId, safeEpisodeId]
    );
    const result = await db.execute(
      "DELETE FROM episodes WHERE project_id = ? AND id = ?",
      [safeProjectId, safeEpisodeId]
    );

    return result.affectedRows > 0;
  });
}

export type ElementListFilter = {
  episodeId?: string;
  kind?: ElementKind;
};

export async function listElements(projectId: string, filter: ElementListFilter = {}) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const clauses = ["project_id = ?"];
  const params: SqlValue[] = [safeProjectId];

  if (filter.kind) {
    clauses.push("kind = ?");
    params.push(normalizedEnum(filter.kind, elementKinds, {
      fallback: "role",
      field: "元素类型"
    }));
  }

  if (filter.episodeId) {
    clauses.push("episode_id = ?");
    params.push(normalizedId(filter.episodeId, "剧集 ID"));
  }

  return readDatabase(async (db) =>
    (
      await getRows<ElementRow>(
        db,
        `SELECT id, project_id, episode_id, kind, name, aliases_json, prompt,
          description, notes, reference_image_url, voice_profile_id, status,
          sort_order, created_at, updated_at
         FROM elements
         WHERE ${clauses.join(" AND ")}
         ORDER BY FIELD(kind, 'role', 'scene', 'prop') ASC,
           sort_order ASC, created_at ASC, id ASC`,
        params
      )
    ).map(mapElement)
  );
}

export async function getElement(projectId: string, elementId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeElementId = normalizedId(elementId, "元素 ID");

  return readDatabase(async (db) => {
    const row = await elementRow(db, safeProjectId, safeElementId);
    return row ? mapElement(row) : null;
  });
}

function convergedElementRow(
  projectId: string,
  id: string,
  raw: Record<string, unknown>,
  current?: ElementRow
): ElementRow {
  const now = new Date().toISOString();

  return {
    aliases_json: JSON.stringify(
      normalizedStringList(raw.aliases, {
        fallback: current ? parseJson<string[]>(current.aliases_json, []) : [],
        field: "元素别名",
        itemMax: 300,
        maxItems: 30
      })
    ),
    created_at: current?.created_at ?? now,
    description: normalizedText(raw.description, {
      fallback: current?.description ?? "",
      field: "元素描述",
      max: 100000
    }),
    episode_id:
      normalizedId(raw.episodeId, "剧集 ID", { optional: true }) ??
      (raw.episodeId === null || raw.episodeId === "" ? null : current?.episode_id ?? null),
    id,
    kind: normalizedEnum(raw.kind, elementKinds, {
      fallback: (current?.kind as ElementKind | undefined) ?? "role",
      field: "元素类型"
    }),
    name: normalizedText(raw.name, {
      fallback: current?.name ?? "",
      field: "元素名称",
      max: 1000,
      maxChars: 255,
      required: true
    }),
    notes: normalizedText(raw.notes, {
      fallback: current?.notes ?? "",
      field: "元素备注",
      max: 100000
    }),
    project_id: projectId,
    prompt: normalizedText(raw.prompt, {
      fallback: current?.prompt ?? "",
      field: "元素提示词",
      max: 200000
    }),
    reference_image_url:
      normalizedMediaUrl(raw.referenceImageUrl, {
        fallback: current?.reference_image_url ?? undefined,
        field: "参考图地址"
      }) ?? null,
    sort_order: normalizedInteger(raw.sortOrder, {
      fallback: Number(current?.sort_order ?? 0),
      field: "排序值",
      max: 100000,
      min: -100000
    }),
    status: normalizedEnum(raw.status, productionStatuses, {
      fallback: (current?.status as ProductionStatus | undefined) ?? "draft",
      field: "元素状态"
    }),
    updated_at: now,
    voice_profile_id:
      normalizedId(raw.voiceProfileId, "音色 ID", { optional: true }) ??
      (raw.voiceProfileId === null || raw.voiceProfileId === ""
        ? null
        : current?.voice_profile_id ?? null)
  };
}

export async function createElement(projectId: string, input: unknown) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const raw = requireRecord(input);

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const row = convergedElementRow(safeProjectId, randomUUID(), raw);

    if (row.episode_id) {
      await requireEpisodeRow(db, safeProjectId, row.episode_id);
    }

    await db.execute(
      `INSERT INTO elements (
        id, project_id, episode_id, kind, name, aliases_json, prompt,
        description, notes, reference_image_url, voice_profile_id, status,
        sort_order, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.project_id,
        row.episode_id,
        row.kind,
        row.name,
        row.aliases_json,
        row.prompt,
        row.description,
        row.notes,
        row.reference_image_url,
        row.voice_profile_id,
        row.status,
        row.sort_order,
        row.created_at,
        row.updated_at
      ]
    );

    return mapElement(row);
  });
}

export async function updateElement(projectId: string, elementId: string, input: unknown) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeElementId = normalizedId(elementId, "元素 ID");
  const raw = requireRecord(input);

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const current = await elementRow(db, safeProjectId, safeElementId);

    if (!current) {
      return null;
    }

    const next = convergedElementRow(safeProjectId, safeElementId, raw, current);

    if (next.episode_id) {
      await requireEpisodeRow(db, safeProjectId, next.episode_id);
    }

    await validateElementMutation(db, current, next);

    await db.execute(
      `UPDATE elements
       SET episode_id = ?, kind = ?, name = ?, aliases_json = ?, prompt = ?,
         description = ?, notes = ?, reference_image_url = ?, voice_profile_id = ?,
         status = ?, sort_order = ?, updated_at = ?
       WHERE project_id = ? AND id = ?`,
      [
        next.episode_id,
        next.kind,
        next.name,
        next.aliases_json,
        next.prompt,
        next.description,
        next.notes,
        next.reference_image_url,
        next.voice_profile_id,
        next.status,
        next.sort_order,
        next.updated_at,
        safeProjectId,
        safeElementId
      ]
    );

    if (current.episode_id !== next.episode_id) {
      await db.execute(
        `UPDATE generation_jobs
         SET episode_id = ?, updated_at = ?
         WHERE project_id = ? AND resource_type = 'element' AND resource_id = ?`,
        [next.episode_id, next.updated_at, safeProjectId, safeElementId]
      );
    }

    return mapElement(next);
  });
}

export async function deleteElement(projectId: string, elementId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeElementId = normalizedId(elementId, "元素 ID");

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const current = await elementRow(db, safeProjectId, safeElementId);

    if (!current) {
      return false;
    }

    const now = new Date().toISOString();
    await db.execute(
      `UPDATE voiceovers
       SET role_element_id = NULL, updated_at = ?
       WHERE project_id = ? AND role_element_id = ?`,
      [now, safeProjectId, safeElementId]
    );
    await db.execute(
      `DELETE FROM generation_jobs
       WHERE project_id = ? AND resource_type = 'element' AND resource_id = ?`,
      [safeProjectId, safeElementId]
    );

    const boards = await getRows<{ element_ids_json: string; id: string }>(
      db,
      `SELECT id, element_ids_json FROM storyboards
       WHERE project_id = ? AND element_ids_json LIKE ?`,
      [safeProjectId, `%${safeElementId}%`]
    );

    for (const board of boards) {
      const currentIds = parseJson<unknown>(board.element_ids_json, []);
      const nextIds = Array.isArray(currentIds)
        ? currentIds.filter((id) => id !== safeElementId)
        : [];

      await db.execute(
        `UPDATE storyboards SET element_ids_json = ?, updated_at = ?
         WHERE project_id = ? AND id = ?`,
        [JSON.stringify(nextIds), now, safeProjectId, board.id]
      );
    }

    const result = await db.execute(
      "DELETE FROM elements WHERE project_id = ? AND id = ?",
      [safeProjectId, safeElementId]
    );

    return result.affectedRows > 0;
  });
}

export type EpisodeFilter = { episodeId?: string };

export async function listStoryboards(projectId: string, filter: EpisodeFilter = {}) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const clauses = ["s.project_id = ?"];
  const params: SqlValue[] = [safeProjectId];

  if (filter.episodeId) {
    clauses.push("s.episode_id = ?");
    params.push(normalizedId(filter.episodeId, "剧集 ID"));
  }

  return readDatabase(async (db) =>
    (
      await getRows<StoryboardRow>(
        db,
        `SELECT s.id, s.project_id, s.episode_id, s.shot_number, s.title,
          s.prompt, s.negative_prompt, s.dialogue, s.camera, s.duration_ms,
          s.element_ids_json, s.reference_image_url, s.image_url, s.video_url,
          s.status, s.sort_order, s.created_at, s.updated_at
         FROM storyboards s
         INNER JOIN episodes e
           ON e.project_id = s.project_id AND e.id = s.episode_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY e.sort_order ASC, e.episode_number ASC,
           s.sort_order ASC, s.shot_number ASC, s.created_at ASC, s.id ASC`,
        params
      )
    ).map(mapStoryboard)
  );
}

export async function getStoryboard(projectId: string, storyboardId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeStoryboardId = normalizedId(storyboardId, "分镜 ID");

  return readDatabase(async (db) => {
    const row = await storyboardRow(db, safeProjectId, safeStoryboardId);
    return row ? mapStoryboard(row) : null;
  });
}

function convergedStoryboardRow(
  projectId: string,
  id: string,
  raw: Record<string, unknown>,
  current: StoryboardRow | undefined,
  defaults: { shotNumber: number }
): StoryboardRow {
  const now = new Date().toISOString();
  const episodeId =
    normalizedId(raw.episodeId, "剧集 ID", { optional: true }) ?? current?.episode_id;

  if (!episodeId) {
    fail("INVALID_INPUT", "请选择分镜所属剧集。");
  }

  const shotNumber = normalizedInteger(raw.shotNumber, {
    fallback: Number(current?.shot_number ?? defaults.shotNumber),
    field: "分镜序号",
    max: 100000,
    min: 1
  });

  return {
    camera: normalizedText(raw.camera, {
      fallback: current?.camera ?? "",
      field: "镜头说明",
      max: 2000,
      maxChars: 500
    }),
    created_at: current?.created_at ?? now,
    dialogue: normalizedText(raw.dialogue, {
      fallback: current?.dialogue ?? "",
      field: "分镜台词",
      max: 100000
    }),
    duration_ms: normalizedInteger(raw.durationMs, {
      fallback: Number(current?.duration_ms ?? 3000),
      field: "分镜时长",
      max: 600000,
      min: 200
    }),
    element_ids_json: JSON.stringify(
      normalizedStringList(raw.elementIds, {
        fallback: current ? parseJson<string[]>(current.element_ids_json, []) : [],
        field: "元素引用",
        itemMax: 191,
        maxItems: 100
      }).map((elementId) => normalizedId(elementId, "元素 ID"))
    ),
    episode_id: episodeId,
    id,
    image_url:
      normalizedMediaUrl(raw.imageUrl, {
        fallback: current?.image_url ?? undefined,
        field: "分镜图地址"
      }) ?? null,
    negative_prompt: normalizedText(raw.negativePrompt, {
      fallback: current?.negative_prompt ?? "",
      field: "负面提示词",
      max: 200000
    }),
    project_id: projectId,
    prompt: normalizedText(raw.prompt, {
      fallback: current?.prompt ?? "",
      field: "分镜提示词",
      max: 200000
    }),
    reference_image_url:
      normalizedMediaUrl(raw.referenceImageUrl, {
        fallback: current?.reference_image_url ?? undefined,
        field: "参考图地址"
      }) ?? null,
    shot_number: shotNumber,
    sort_order: normalizedInteger(raw.sortOrder, {
      fallback: Number(current?.sort_order ?? shotNumber),
      field: "排序值",
      max: 100000,
      min: -100000
    }),
    status: normalizedEnum(raw.status, productionStatuses, {
      fallback: (current?.status as ProductionStatus | undefined) ?? "draft",
      field: "分镜状态"
    }),
    title: normalizedText(raw.title, {
      fallback: current?.title ?? `镜头 ${shotNumber}`,
      field: "分镜标题",
      max: 1000,
      maxChars: 255,
      required: true
    }),
    updated_at: now,
    video_url:
      normalizedMediaUrl(raw.videoUrl, {
        fallback: current?.video_url ?? undefined,
        field: "视频地址"
      }) ?? null
  };
}

export async function createStoryboard(projectId: string, input: unknown) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const raw = requireRecord(input);
  const episodeId = normalizedId(raw.episodeId, "剧集 ID");

  try {
    return await writeDatabase(async (db) => {
      await requireLockedProject(db, safeProjectId);
      await requireEpisodeRow(db, safeProjectId, episodeId);
      const maxRow = await getFirstRow<{ max_number: number | null }>(
        db,
        `SELECT MAX(shot_number) AS max_number
         FROM storyboards WHERE project_id = ? AND episode_id = ?`,
        [safeProjectId, episodeId]
      );
      const row = convergedStoryboardRow(
        safeProjectId,
        randomUUID(),
        raw,
        undefined,
        { shotNumber: Number(maxRow?.max_number ?? 0) + 1 }
      );
      const elementIds = parseJson<string[]>(row.element_ids_json, []);
      await validateElementIds(db, safeProjectId, row.episode_id, elementIds);

      await db.execute(
        `INSERT INTO storyboards (
          id, project_id, episode_id, shot_number, title, prompt,
          negative_prompt, dialogue, camera, duration_ms, element_ids_json,
          reference_image_url, image_url, video_url, status, sort_order,
          created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.project_id,
          row.episode_id,
          row.shot_number,
          row.title,
          row.prompt,
          row.negative_prompt,
          row.dialogue,
          row.camera,
          row.duration_ms,
          row.element_ids_json,
          row.reference_image_url,
          row.image_url,
          row.video_url,
          row.status,
          row.sort_order,
          row.created_at,
          row.updated_at
        ]
      );

      return mapStoryboard(row);
    });
  } catch (error) {
    translateWriteError(error, "当前剧集已存在相同序号的分镜。");
  }
}

export async function updateStoryboard(
  projectId: string,
  storyboardId: string,
  input: unknown
) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeStoryboardId = normalizedId(storyboardId, "分镜 ID");
  const raw = requireRecord(input);

  try {
    return await writeDatabase(async (db) => {
      await requireLockedProject(db, safeProjectId);
      const current = await storyboardRow(db, safeProjectId, safeStoryboardId);

      if (!current) {
        return null;
      }

      const next = convergedStoryboardRow(
        safeProjectId,
        safeStoryboardId,
        raw,
        current,
        { shotNumber: current.shot_number }
      );
      await requireEpisodeRow(db, safeProjectId, next.episode_id);
      await validateElementIds(
        db,
        safeProjectId,
        next.episode_id,
        parseJson<string[]>(next.element_ids_json, [])
      );
      const conflict = await getFirstRow<{ id: string }>(
        db,
        `SELECT id FROM storyboards
         WHERE project_id = ? AND episode_id = ? AND shot_number = ? AND id <> ?`,
        [safeProjectId, next.episode_id, next.shot_number, safeStoryboardId]
      );

      if (conflict) {
        fail("RESOURCE_CONFLICT", "当前剧集已存在相同序号的分镜。", 409);
      }

      if (next.episode_id !== current.episode_id) {
        const linkedVoiceover = await getFirstRow<{ id: string }>(
          db,
          `SELECT id FROM voiceovers
           WHERE project_id = ? AND storyboard_id = ? LIMIT 1`,
          [safeProjectId, safeStoryboardId]
        );

        if (linkedVoiceover) {
          fail(
            "RESOURCE_CONFLICT",
            "该分镜已有配音，不能直接移动到其他剧集。请先解除配音关联。",
            409
          );
        }
      }

      await db.execute(
        `UPDATE storyboards
         SET episode_id = ?, shot_number = ?, title = ?, prompt = ?,
           negative_prompt = ?, dialogue = ?, camera = ?, duration_ms = ?,
           element_ids_json = ?, reference_image_url = ?, image_url = ?,
           video_url = ?, status = ?, sort_order = ?, updated_at = ?
         WHERE project_id = ? AND id = ?`,
        [
          next.episode_id,
          next.shot_number,
          next.title,
          next.prompt,
          next.negative_prompt,
          next.dialogue,
          next.camera,
          next.duration_ms,
          next.element_ids_json,
          next.reference_image_url,
          next.image_url,
          next.video_url,
          next.status,
          next.sort_order,
          next.updated_at,
          safeProjectId,
          safeStoryboardId
        ]
      );

      if (next.episode_id !== current.episode_id) {
        await db.execute(
          `UPDATE generation_jobs
           SET episode_id = ?, updated_at = ?
           WHERE project_id = ? AND resource_type = 'storyboard' AND resource_id = ?`,
          [next.episode_id, next.updated_at, safeProjectId, safeStoryboardId]
        );
      }

      return mapStoryboard(next);
    });
  } catch (error) {
    translateWriteError(error, "当前剧集已存在相同序号的分镜。");
  }
}

export async function deleteStoryboard(projectId: string, storyboardId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeStoryboardId = normalizedId(storyboardId, "分镜 ID");

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const current = await storyboardRow(db, safeProjectId, safeStoryboardId);

    if (!current) {
      return false;
    }

    await db.execute(
      `UPDATE voiceovers
       SET storyboard_id = NULL, updated_at = ?
       WHERE project_id = ? AND storyboard_id = ?`,
      [new Date().toISOString(), safeProjectId, safeStoryboardId]
    );
    await db.execute(
      `DELETE FROM generation_jobs
       WHERE project_id = ? AND resource_type = 'storyboard' AND resource_id = ?`,
      [safeProjectId, safeStoryboardId]
    );
    const result = await db.execute(
      "DELETE FROM storyboards WHERE project_id = ? AND id = ?",
      [safeProjectId, safeStoryboardId]
    );

    return result.affectedRows > 0;
  });
}

export async function listVoiceovers(projectId: string, filter: EpisodeFilter = {}) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const clauses = ["v.project_id = ?"];
  const params: SqlValue[] = [safeProjectId];

  if (filter.episodeId) {
    clauses.push("v.episode_id = ?");
    params.push(normalizedId(filter.episodeId, "剧集 ID"));
  }

  return readDatabase(async (db) =>
    (
      await getRows<VoiceoverRow>(
        db,
        `SELECT v.id, v.project_id, v.episode_id, v.storyboard_id,
          v.role_element_id, v.line_text, v.speaker_name, v.voice_profile_id,
          v.audio_url, v.duration_ms, v.status, v.sort_order,
          v.created_at, v.updated_at
         FROM voiceovers v
         INNER JOIN episodes e
           ON e.project_id = v.project_id AND e.id = v.episode_id
         LEFT JOIN storyboards s
           ON s.project_id = v.project_id AND s.id = v.storyboard_id
         WHERE ${clauses.join(" AND ")}
         ORDER BY e.sort_order ASC, e.episode_number ASC,
           COALESCE(s.sort_order, 2147483647) ASC,
           v.sort_order ASC, v.created_at ASC, v.id ASC`,
        params
      )
    ).map(mapVoiceover)
  );
}

export async function getVoiceover(projectId: string, voiceoverId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeVoiceoverId = normalizedId(voiceoverId, "配音 ID");

  return readDatabase(async (db) => {
    const row = await voiceoverRow(db, safeProjectId, safeVoiceoverId);
    return row ? mapVoiceover(row) : null;
  });
}

function convergedVoiceoverRow(
  projectId: string,
  id: string,
  raw: Record<string, unknown>,
  current?: VoiceoverRow
): VoiceoverRow {
  const now = new Date().toISOString();
  const episodeId =
    normalizedId(raw.episodeId, "剧集 ID", { optional: true }) ?? current?.episode_id;

  if (!episodeId) {
    fail("INVALID_INPUT", "请选择配音所属剧集。");
  }

  return {
    audio_url:
      normalizedMediaUrl(raw.audioUrl, {
        fallback: current?.audio_url ?? undefined,
        field: "音频地址"
      }) ?? null,
    created_at: current?.created_at ?? now,
    duration_ms: normalizedInteger(raw.durationMs, {
      fallback: Number(current?.duration_ms ?? 0),
      field: "配音时长",
      max: 3600000,
      min: 0
    }),
    episode_id: episodeId,
    id,
    line_text: normalizedText(raw.lineText, {
      fallback: current?.line_text ?? "",
      field: "配音台词",
      max: 100000,
      required: true
    }),
    project_id: projectId,
    role_element_id:
      normalizedId(raw.roleElementId, "角色元素 ID", { optional: true }) ??
      (raw.roleElementId === null || raw.roleElementId === ""
        ? null
        : current?.role_element_id ?? null),
    sort_order: normalizedInteger(raw.sortOrder, {
      fallback: Number(current?.sort_order ?? 0),
      field: "排序值",
      max: 100000,
      min: -100000
    }),
    speaker_name: normalizedText(raw.speakerName, {
      fallback: current?.speaker_name ?? "",
      field: "说话人",
      max: 1000,
      maxChars: 255
    }),
    status: normalizedEnum(raw.status, productionStatuses, {
      fallback: (current?.status as ProductionStatus | undefined) ?? "draft",
      field: "配音状态"
    }),
    storyboard_id:
      normalizedId(raw.storyboardId, "分镜 ID", { optional: true }) ??
      (raw.storyboardId === null || raw.storyboardId === ""
        ? null
        : current?.storyboard_id ?? null),
    updated_at: now,
    voice_profile_id:
      normalizedId(raw.voiceProfileId, "音色 ID", { optional: true }) ??
      (raw.voiceProfileId === null || raw.voiceProfileId === ""
        ? null
        : current?.voice_profile_id ?? null)
  };
}

async function validateVoiceoverReferences(db: Database, row: VoiceoverRow) {
  await requireEpisodeRow(db, row.project_id, row.episode_id);

  if (row.storyboard_id) {
    const storyboard = await storyboardRow(db, row.project_id, row.storyboard_id);

    if (!storyboard || storyboard.episode_id !== row.episode_id) {
      fail("INVALID_STORYBOARD_REFERENCE", "配音引用的分镜不存在或不属于该剧集。", 400);
    }
  }

  if (row.role_element_id) {
    const element = await elementRow(db, row.project_id, row.role_element_id);

    if (
      !element ||
      element.kind !== "role" ||
      (element.episode_id && element.episode_id !== row.episode_id)
    ) {
      fail("INVALID_ROLE_REFERENCE", "配音引用的角色不存在或不属于该剧集。", 400);
    }
  }
}

export async function createVoiceover(projectId: string, input: unknown) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const raw = requireRecord(input);

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const row = convergedVoiceoverRow(safeProjectId, randomUUID(), raw);
    await validateVoiceoverReferences(db, row);

    await db.execute(
      `INSERT INTO voiceovers (
        id, project_id, episode_id, storyboard_id, role_element_id,
        line_text, speaker_name, voice_profile_id, audio_url, duration_ms,
        status, sort_order, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.project_id,
        row.episode_id,
        row.storyboard_id,
        row.role_element_id,
        row.line_text,
        row.speaker_name,
        row.voice_profile_id,
        row.audio_url,
        row.duration_ms,
        row.status,
        row.sort_order,
        row.created_at,
        row.updated_at
      ]
    );

    return mapVoiceover(row);
  });
}

export async function updateVoiceover(
  projectId: string,
  voiceoverId: string,
  input: unknown
) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeVoiceoverId = normalizedId(voiceoverId, "配音 ID");
  const raw = requireRecord(input);

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const current = await voiceoverRow(db, safeProjectId, safeVoiceoverId);

    if (!current) {
      return null;
    }

    const next = convergedVoiceoverRow(safeProjectId, safeVoiceoverId, raw, current);
    await validateVoiceoverReferences(db, next);

    await db.execute(
      `UPDATE voiceovers
       SET episode_id = ?, storyboard_id = ?, role_element_id = ?,
         line_text = ?, speaker_name = ?, voice_profile_id = ?, audio_url = ?,
         duration_ms = ?, status = ?, sort_order = ?, updated_at = ?
       WHERE project_id = ? AND id = ?`,
      [
        next.episode_id,
        next.storyboard_id,
        next.role_element_id,
        next.line_text,
        next.speaker_name,
        next.voice_profile_id,
        next.audio_url,
        next.duration_ms,
        next.status,
        next.sort_order,
        next.updated_at,
        safeProjectId,
        safeVoiceoverId
      ]
    );

    if (next.episode_id !== current.episode_id) {
      await db.execute(
        `UPDATE generation_jobs
         SET episode_id = ?, updated_at = ?
         WHERE project_id = ? AND resource_type = 'voiceover' AND resource_id = ?`,
        [next.episode_id, next.updated_at, safeProjectId, safeVoiceoverId]
      );
    }

    return mapVoiceover(next);
  });
}

export async function deleteVoiceover(projectId: string, voiceoverId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeVoiceoverId = normalizedId(voiceoverId, "配音 ID");

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const current = await voiceoverRow(db, safeProjectId, safeVoiceoverId);

    if (!current) {
      return false;
    }

    await db.execute(
      `DELETE FROM generation_jobs
       WHERE project_id = ? AND resource_type = 'voiceover' AND resource_id = ?`,
      [safeProjectId, safeVoiceoverId]
    );
    const result = await db.execute(
      "DELETE FROM voiceovers WHERE project_id = ? AND id = ?",
      [safeProjectId, safeVoiceoverId]
    );

    return result.affectedRows > 0;
  });
}

export async function getComposition(projectId: string, episodeId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeEpisodeId = normalizedId(episodeId, "剧集 ID");

  return readDatabase(async (db) => {
    const episode = await episodeRow(db, safeProjectId, safeEpisodeId);

    if (!episode) {
      fail("EPISODE_NOT_FOUND", "剧集不存在或不属于当前项目。", 404);
    }

    const row = await compositionRow(db, safeProjectId, safeEpisodeId);
    return row ? mapComposition(row) : null;
  });
}

function convergedComposition(
  raw: Record<string, unknown>,
  current?: CompositionRow
) {
  const timelineValue = raw.timeline === undefined
    ? current
      ? parseJson<unknown>(current.timeline_json, [])
      : []
    : raw.timeline;
  const settingsValue = raw.settings === undefined
    ? current
      ? parseJson<unknown>(current.settings_json, {})
      : {}
    : raw.settings;

  if (!Array.isArray(timelineValue) || timelineValue.length > 2000) {
    fail("INVALID_INPUT", "合成时间线必须是数组，且最多包含 2000 项。", 400);
  }

  if (!isRecord(settingsValue)) {
    fail("INVALID_INPUT", "合成设置必须是 JSON 对象。", 400);
  }

  if (byteLength(timelineValue) > 1536 * 1024) {
    fail("INPUT_TOO_LARGE", "合成时间线不能超过 1.5MB。", 413);
  }

  if (byteLength(settingsValue) > 128 * 1024) {
    fail("INPUT_TOO_LARGE", "合成设置不能超过 128KB。", 413);
  }

  return {
    outputUrl:
      normalizedMediaUrl(raw.outputUrl, {
        fallback: current?.output_url ?? undefined,
        field: "合成输出地址"
      }) ?? null,
    settingsJson: JSON.stringify(settingsValue),
    status: normalizedEnum(raw.status, productionStatuses, {
      fallback: (current?.status as ProductionStatus | undefined) ?? "draft",
      field: "合成状态"
    }),
    timelineJson: JSON.stringify(timelineValue)
  };
}

export type SaveCompositionResult =
  | { composition: Composition; status: "saved" }
  | { current: Composition | null; status: "conflict" };

export async function saveComposition(
  projectId: string,
  episodeId: string,
  input: unknown
): Promise<SaveCompositionResult> {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const safeEpisodeId = normalizedId(episodeId, "剧集 ID");
  const raw = requireRecord(input);
  const expectedRevision = normalizedInteger(raw.revision, {
    fallback: -1,
    field: "版本号",
    max: 2147483646,
    min: 0
  });

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    await requireEpisodeRow(db, safeProjectId, safeEpisodeId);
    const current = await compositionRow(db, safeProjectId, safeEpisodeId);

    if (!current) {
      if (expectedRevision !== 0) {
        return { current: null, status: "conflict" };
      }

      const values = convergedComposition(raw);
      const now = new Date().toISOString();
      const row: CompositionRow = {
        created_at: now,
        episode_id: safeEpisodeId,
        id: randomUUID(),
        output_url: values.outputUrl,
        project_id: safeProjectId,
        revision: 1,
        settings_json: values.settingsJson,
        status: values.status,
        timeline_json: values.timelineJson,
        updated_at: now
      };

      try {
        await db.execute(
          `INSERT INTO compositions (
            id, project_id, episode_id, timeline_json, settings_json,
            output_url, status, revision, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.project_id,
            row.episode_id,
            row.timeline_json,
            row.settings_json,
            row.output_url,
            row.status,
            row.revision,
            row.created_at,
            row.updated_at
          ]
        );
      } catch (error) {
        if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
          const latest = await compositionRow(db, safeProjectId, safeEpisodeId);
          return {
            current: latest ? mapComposition(latest) : null,
            status: "conflict"
          };
        }

        throw error;
      }

      return { composition: mapComposition(row), status: "saved" };
    }

    if (Number(current.revision) !== expectedRevision) {
      return { current: mapComposition(current), status: "conflict" };
    }

    const values = convergedComposition(raw, current);
    const now = new Date().toISOString();
    const nextRevision = expectedRevision + 1;
    const result = await db.execute(
      `UPDATE compositions
       SET timeline_json = ?, settings_json = ?, output_url = ?, status = ?,
         revision = ?, updated_at = ?
       WHERE project_id = ? AND episode_id = ? AND revision = ?`,
      [
        values.timelineJson,
        values.settingsJson,
        values.outputUrl,
        values.status,
        nextRevision,
        now,
        safeProjectId,
        safeEpisodeId,
        expectedRevision
      ]
    );

    if (result.affectedRows !== 1) {
      const latest = await compositionRow(db, safeProjectId, safeEpisodeId);
      return {
        current: latest ? mapComposition(latest) : null,
        status: "conflict"
      };
    }

    return {
      composition: mapComposition({
        ...current,
        output_url: values.outputUrl,
        revision: nextRevision,
        settings_json: values.settingsJson,
        status: values.status,
        timeline_json: values.timelineJson,
        updated_at: now
      }),
      status: "saved"
    };
  });
}

export type GenerationJobListFilter = {
  episodeId?: string;
  limit?: number;
  resourceType?: GenerationResourceType;
  status?: GenerationJobStatus;
  taskType?: GenerationTaskType;
};

export async function listGenerationJobs(
  projectId: string,
  filter: GenerationJobListFilter = {}
) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const clauses = ["project_id = ?"];
  const params: SqlValue[] = [safeProjectId];
  const limit = normalizedInteger(filter.limit, {
    fallback: 50,
    field: "返回数量",
    max: 100,
    min: 1
  });

  if (filter.episodeId) {
    clauses.push("episode_id = ?");
    params.push(normalizedId(filter.episodeId, "剧集 ID"));
  }

  if (filter.resourceType) {
    clauses.push("resource_type = ?");
    params.push(
      normalizedEnum(filter.resourceType, generationResourceTypes, {
        fallback: "episode",
        field: "任务资源类型"
      })
    );
  }

  if (filter.status) {
    clauses.push("status = ?");
    params.push(
      normalizedEnum(filter.status, generationJobStatuses, {
        fallback: "queued",
        field: "任务状态"
      })
    );
  }

  if (filter.taskType) {
    clauses.push("task_type = ?");
    params.push(
      normalizedEnum(filter.taskType, generationTaskTypes, {
        fallback: "script_analysis",
        field: "任务类型"
      })
    );
  }

  return readDatabase(async (db) =>
    (
      await getRows<GenerationJobRow>(
        db,
        `SELECT id, project_id, episode_id, resource_type, resource_id,
          task_type, status, input_json, output_json, error, model_config_id,
          created_by_id, created_by_account, attempt_count, created_at, updated_at
         FROM generation_jobs
         WHERE ${clauses.join(" AND ")}
         ORDER BY created_at DESC, id DESC
         LIMIT ${limit}`,
        params
      )
    ).map(mapGenerationJob)
  );
}

const taskResourceType: Record<GenerationTaskType, GenerationResourceType> = {
  composition_export: "composition",
  element_image: "element",
  script_analysis: "episode",
  storyboard_image: "storyboard",
  storyboard_video: "storyboard",
  voiceover_audio: "voiceover"
};

async function validateGenerationResource(
  db: Database,
  projectId: string,
  resourceType: GenerationResourceType,
  resourceId: string,
  requestedEpisodeId?: string
) {
  if (resourceType === "episode") {
    const episode = await requireEpisodeRow(db, projectId, resourceId);

    if (requestedEpisodeId && requestedEpisodeId !== episode.id) {
      fail("INVALID_EPISODE_REFERENCE", "任务剧集与目标资源不一致。", 400);
    }

    return episode.id;
  }

  if (resourceType === "element") {
    const element = await elementRow(db, projectId, resourceId);

    if (!element) {
      fail("ELEMENT_NOT_FOUND", "任务目标元素不存在或不属于当前项目。", 404);
    }

    if (requestedEpisodeId) {
      await requireEpisodeRow(db, projectId, requestedEpisodeId);

      if (element.episode_id && element.episode_id !== requestedEpisodeId) {
        fail("INVALID_EPISODE_REFERENCE", "任务剧集与目标元素不一致。", 400);
      }
    }

    return element.episode_id ?? requestedEpisodeId;
  }

  if (resourceType === "storyboard") {
    const storyboard = await storyboardRow(db, projectId, resourceId);

    if (!storyboard) {
      fail("STORYBOARD_NOT_FOUND", "任务目标分镜不存在或不属于当前项目。", 404);
    }

    if (requestedEpisodeId && requestedEpisodeId !== storyboard.episode_id) {
      fail("INVALID_EPISODE_REFERENCE", "任务剧集与目标分镜不一致。", 400);
    }

    return storyboard.episode_id;
  }

  if (resourceType === "voiceover") {
    const voiceover = await voiceoverRow(db, projectId, resourceId);

    if (!voiceover) {
      fail("VOICEOVER_NOT_FOUND", "任务目标配音不存在或不属于当前项目。", 404);
    }

    if (requestedEpisodeId && requestedEpisodeId !== voiceover.episode_id) {
      fail("INVALID_EPISODE_REFERENCE", "任务剧集与目标配音不一致。", 400);
    }

    return voiceover.episode_id;
  }

  const composition = await compositionByIdRow(db, projectId, resourceId);

  if (!composition) {
    fail("COMPOSITION_NOT_FOUND", "任务目标合成工程不存在。", 404);
  }

  if (requestedEpisodeId && requestedEpisodeId !== composition.episode_id) {
    fail("INVALID_EPISODE_REFERENCE", "任务剧集与合成工程不一致。", 400);
  }

  return composition.episode_id;
}

export type CreateGenerationJobActor = {
  account: string;
  id?: string;
};

export async function createGenerationJob(
  projectId: string,
  input: unknown,
  actor: CreateGenerationJobActor
) {
  const safeProjectId = normalizedId(projectId, "项目 ID");
  const raw = requireRecord(input);
  const resourceType = normalizedEnum(raw.resourceType, generationResourceTypes, {
    fallback: "episode",
    field: "任务资源类型"
  });
  const resourceId = normalizedId(raw.resourceId, "任务资源 ID");
  const taskType = normalizedEnum(raw.taskType, generationTaskTypes, {
    fallback: "script_analysis",
    field: "任务类型"
  });
  const requestedEpisodeId = normalizedId(raw.episodeId, "剧集 ID", {
    optional: true
  });

  if (taskResourceType[taskType] !== resourceType) {
    fail("INVALID_TASK_RESOURCE", "任务类型与目标资源类型不匹配。", 400, {
      expectedResourceType: taskResourceType[taskType]
    });
  }

  if (raw.status !== undefined && raw.status !== "queued") {
    fail("INVALID_JOB_STATUS", "新任务只能以 queued 状态创建。", 400);
  }

  const payload = raw.input === undefined ? {} : raw.input;

  if (!isRecord(payload)) {
    fail("INVALID_INPUT", "任务输入必须是 JSON 对象。", 400);
  }

  if (byteLength(payload) > 256 * 1024) {
    fail("INPUT_TOO_LARGE", "任务输入不能超过 256KB。", 413);
  }

  const modelConfigId = normalizedId(raw.modelConfigId, "模型配置 ID", {
    optional: true
  });

  return writeDatabase(async (db) => {
    await requireLockedProject(db, safeProjectId);
    const episodeId = await validateGenerationResource(
      db,
      safeProjectId,
      resourceType,
      resourceId,
      requestedEpisodeId
    );
    const now = new Date().toISOString();
    const row: GenerationJobRow = {
      attempt_count: 0,
      created_at: now,
      created_by_account: normalizedText(actor.account, {
        field: "创建账号",
        max: 1000,
        maxChars: 255,
        required: true
      }),
      created_by_id: actor.id ? normalizedId(actor.id, "创建人 ID") : null,
      episode_id: episodeId ?? null,
      error: null,
      id: randomUUID(),
      input_json: JSON.stringify(payload),
      model_config_id: modelConfigId ?? null,
      output_json: null,
      project_id: safeProjectId,
      resource_id: resourceId,
      resource_type: resourceType,
      status: "queued",
      task_type: taskType,
      updated_at: now
    };

    await db.execute(
      `INSERT INTO generation_jobs (
        id, project_id, episode_id, resource_type, resource_id, task_type,
        status, input_json, output_json, error, model_config_id, created_by_id,
        created_by_account, attempt_count, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.project_id,
        row.episode_id,
        row.resource_type,
        row.resource_id,
        row.task_type,
        row.status,
        row.input_json,
        row.output_json,
        row.error,
        row.model_config_id,
        row.created_by_id,
        row.created_by_account,
        row.attempt_count,
        row.created_at,
        row.updated_at
      ]
    );

    return mapGenerationJob(row);
  });
}

export async function deleteProjectProductionData(db: Database, projectId: string) {
  const safeProjectId = normalizedId(projectId, "项目 ID");

  await db.execute("DELETE FROM generation_jobs WHERE project_id = ?", [safeProjectId]);
  await db.execute("DELETE FROM voiceovers WHERE project_id = ?", [safeProjectId]);
  await db.execute("DELETE FROM storyboards WHERE project_id = ?", [safeProjectId]);
  await db.execute("DELETE FROM compositions WHERE project_id = ?", [safeProjectId]);
  await db.execute("DELETE FROM elements WHERE project_id = ?", [safeProjectId]);
  await db.execute("DELETE FROM episodes WHERE project_id = ?", [safeProjectId]);
}
