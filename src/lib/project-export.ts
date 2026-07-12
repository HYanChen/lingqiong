import {
  getRows,
  readDatabase
} from "@/lib/database";
import {
  getComposition,
  listElements,
  listEpisodes,
  listStoryboards,
  listVoiceovers,
  ProductionPipelineError,
  type GenerationJob,
  type GenerationJobStatus,
  type GenerationResourceType,
  type GenerationTaskType
} from "@/lib/production-pipeline";
import {
  listProjectUploads,
  type StoredProject
} from "@/lib/projects";

export const projectExportSections = [
  "project",
  "episodes",
  "roles",
  "scenes",
  "props",
  "storyboards",
  "voiceovers",
  "compositions",
  "generationJobs",
  "uploads"
] as const;

export type ProjectExportSection = (typeof projectExportSections)[number];

type GenerationJobExportRow = {
  attempt_count: number;
  created_at: string;
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

const sectionLookup = new Map<string, ProjectExportSection>(
  projectExportSections.map((section) => [section.toLowerCase(), section])
);

const sensitiveKeyPattern = /^(?:api[_ -]?key|authorization|client[_ -]?secret|cookie|credential|password|passphrase|private[_ -]?key|secret(?:[_ -]?key)?|session(?:[_ -]?id)?|signing[_ -]?key|(?:access|id|refresh)?[_ -]?token)$/i;
const sensitiveUrlParameterPattern = /(?:api[_-]?key|credential|key|secret|signature|token)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecordJson(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function redactSensitiveUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);

    for (const key of url.searchParams.keys()) {
      if (sensitiveUrlParameterPattern.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }

    return url.toString();
  } catch {
    return value;
  }
}

function safeExportValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(safeExportValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKeyPattern.test(key)
          ? "[REDACTED]"
          : safeExportValue(nestedValue)
      ])
    );
  }

  return typeof value === "string" ? redactSensitiveUrl(value) : value;
}

function publicProject(project: StoredProject) {
  return {
    aspectRatio: project.aspectRatio,
    coverImage: project.coverImage,
    createdAt: project.createdAt,
    deliverables: project.deliverables,
    goal: project.goal,
    id: project.id,
    name: project.name,
    source: project.source,
    style: project.style,
    type: project.type,
    updatedAt: project.updatedAt
  };
}

async function listAllGenerationJobs(projectId: string) {
  return readDatabase(async (db) =>
    (
      await getRows<GenerationJobExportRow>(
        db,
        `SELECT id, project_id, episode_id, resource_type, resource_id,
          task_type, status, input_json, output_json, error, model_config_id,
          attempt_count, created_at, updated_at
         FROM generation_jobs
         WHERE project_id = ?
         ORDER BY created_at DESC, id DESC`,
        [projectId]
      )
    ).map((row) => {
      const output = parseRecordJson(row.output_json);

      return {
        attemptCount: Number(row.attempt_count),
        createdAt: row.created_at,
        episodeId: row.episode_id ?? undefined,
        error: row.error ?? undefined,
        id: row.id,
        input: parseRecordJson(row.input_json) ?? {},
        modelConfigId: row.model_config_id ?? undefined,
        output,
        projectId: row.project_id,
        resourceId: row.resource_id,
        resourceType: row.resource_type as GenerationResourceType,
        status: row.status as GenerationJobStatus,
        taskType: row.task_type as GenerationTaskType,
        updatedAt: row.updated_at
      } satisfies GenerationJob;
    })
  );
}

export function parseProjectExportSections(request: Request) {
  const url = new URL(request.url);
  return parseProjectExportSectionValues(
    url.searchParams
      .getAll("sections")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function parseProjectExportSectionValues(value: unknown) {
  const requested =
    value === undefined || value === null
      ? []
      : typeof value === "string"
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : Array.isArray(value) && value.every((item) => typeof item === "string")
          ? value
              .flatMap((item) => item.split(","))
              .map((item) => item.trim())
              .filter(Boolean)
          : null;

  if (!requested) {
    throw new ProductionPipelineError(
      "INVALID_EXPORT_SECTIONS",
      "sections 必须是分区名称数组或逗号分隔文本。",
      400,
      { allowedSections: [...projectExportSections] }
    );
  }

  if (
    !requested.length ||
    requested.some((value) => value.toLowerCase() === "all")
  ) {
    return [...projectExportSections];
  }

  const selected = new Set<ProjectExportSection>();
  const invalid: string[] = [];

  for (const value of requested) {
    const normalized = value.toLowerCase();

    if (normalized === "elements") {
      selected.add("roles");
      selected.add("scenes");
      selected.add("props");
      continue;
    }

    const section = sectionLookup.get(normalized);

    if (section) {
      selected.add(section);
    } else {
      invalid.push(value);
    }
  }

  if (invalid.length) {
    throw new ProductionPipelineError(
      "INVALID_EXPORT_SECTIONS",
      `不支持的导出分区：${invalid.join("、")}。`,
      400,
      { allowedSections: [...projectExportSections] }
    );
  }

  return projectExportSections.filter((section) => selected.has(section));
}

export function projectExportDownloadRequested(request: Request) {
  const value = new URL(request.url).searchParams.get("download")?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function projectExportContentDisposition(projectName: string) {
  const normalized = projectName
    .normalize("NFKC")
    .replace(/\p{Cc}+/gu, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "project";
  const fileName = `${normalized}-完整项目.json`;
  const fallback = Array.from(fileName)
    .map((character) => (/^[A-Za-z0-9._ -]$/.test(character) ? character : "_"))
    .join("")
    .replace(/_+/g, "_")
    .slice(0, 180) || "project-export.json";
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function buildProjectExport(
  project: StoredProject,
  sections: ProjectExportSection[]
) {
  const selected = new Set(sections);
  const needsEpisodes = selected.has("episodes") || selected.has("compositions");
  const needsElements =
    selected.has("roles") || selected.has("scenes") || selected.has("props");

  const episodesPromise = needsEpisodes ? listEpisodes(project.id) : Promise.resolve([]);
  const elementsPromise = needsElements ? listElements(project.id) : Promise.resolve([]);
  const storyboardsPromise = selected.has("storyboards")
    ? listStoryboards(project.id)
    : Promise.resolve([]);
  const voiceoversPromise = selected.has("voiceovers")
    ? listVoiceovers(project.id)
    : Promise.resolve([]);
  const generationJobsPromise = selected.has("generationJobs")
    ? listAllGenerationJobs(project.id)
    : Promise.resolve([]);
  const uploadsPromise = selected.has("uploads")
    ? listProjectUploads(project.id)
    : Promise.resolve([]);

  const [episodes, elements, storyboards, voiceovers, generationJobs, uploads] =
    await Promise.all([
      episodesPromise,
      elementsPromise,
      storyboardsPromise,
      voiceoversPromise,
      generationJobsPromise,
      uploadsPromise
    ]);

  const compositions = selected.has("compositions")
    ? (await Promise.all(
        episodes.map((episode) => getComposition(project.id, episode.id))
      )).filter((composition) => composition !== null)
    : [];
  const data: Record<string, unknown> = {};

  if (selected.has("project")) {
    data.project = publicProject(project);
  }

  if (selected.has("episodes")) {
    data.episodes = episodes;
  }

  if (selected.has("roles")) {
    data.roles = elements.filter((element) => element.kind === "role");
  }

  if (selected.has("scenes")) {
    data.scenes = elements.filter((element) => element.kind === "scene");
  }

  if (selected.has("props")) {
    data.props = elements.filter((element) => element.kind === "prop");
  }

  if (selected.has("storyboards")) {
    data.storyboards = storyboards;
  }

  if (selected.has("voiceovers")) {
    data.voiceovers = voiceovers;
  }

  if (selected.has("compositions")) {
    data.compositions = compositions;
  }

  if (selected.has("generationJobs")) {
    data.generationJobs = generationJobs;
  }

  if (selected.has("uploads")) {
    data.uploads = uploads.map((upload) => ({
      createdAt: upload.createdAt,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      fileType: upload.fileType,
      id: upload.id,
      projectId: upload.projectId
    }));
  }

  return safeExportValue({
    data,
    exportedAt: new Date().toISOString(),
    ok: true,
    projectId: project.id,
    schemaVersion: "1.0",
    sections
  });
}
