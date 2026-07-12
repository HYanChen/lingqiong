import { randomUUID } from "node:crypto";

import { getFirstRow, getRows, readDatabase, writeDatabase } from "@/lib/database";
import { deleteProjectProductionData } from "@/lib/production-pipeline";

export type StoredProject = {
  aspectRatio: string;
  coverImage?: string;
  id: string;
  ownerId?: string;
  ownerAccount?: string;
  name: string;
  type: string;
  source: string;
  goal: string;
  style: string;
  deliverables: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectUpload = {
  createdAt: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  id: string;
  ownerAccount?: string;
  ownerId?: string;
  projectId: string;
  storagePath: string;
};

type ProjectRow = {
  aspect_ratio: string | null;
  cover_image: string | null;
  created_at: string;
  deliverables_json: string;
  goal: string;
  id: string;
  name: string;
  owner_account: string | null;
  owner_id: string | null;
  source: string;
  style: string;
  type: string;
  updated_at: string;
};

type ProjectUploadRow = {
  created_at: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  id: string;
  owner_account: string | null;
  owner_id: string | null;
  project_id: string;
  storage_path: string;
};

export type CreateProjectInput = Omit<
  StoredProject,
  "createdAt" | "id" | "updatedAt"
>;

export type UpdateProjectInput = Partial<CreateProjectInput>;

export type CreateProjectUploadInput = Omit<ProjectUpload, "createdAt" | "id">;

export type ProjectListFilter = {
  limit?: number;
  ownerAccount?: string;
  ownerId?: string;
};

function parseDeliverables(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapProject(row: ProjectRow): StoredProject {
  return {
    aspectRatio: row.aspect_ratio ?? "9:16",
    coverImage: row.cover_image ?? undefined,
    createdAt: row.created_at,
    deliverables: parseDeliverables(row.deliverables_json),
    goal: row.goal,
    id: row.id,
    name: row.name,
    ownerAccount: row.owner_account ?? undefined,
    ownerId: row.owner_id ?? undefined,
    source: row.source,
    style: row.style,
    type: row.type,
    updatedAt: row.updated_at
  };
}

function mapProjectUpload(row: ProjectUploadRow): ProjectUpload {
  return {
    createdAt: row.created_at,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    fileType: row.file_type ?? undefined,
    id: row.id,
    ownerAccount: row.owner_account ?? undefined,
    ownerId: row.owner_id ?? undefined,
    projectId: row.project_id,
    storagePath: row.storage_path
  };
}

export async function createProject(input: CreateProjectInput) {
  const now = new Date().toISOString();
  const project: StoredProject = {
    ...input,
    aspectRatio: input.aspectRatio || "9:16",
    createdAt: now,
    deliverables: input.deliverables.length ? input.deliverables : ["影视大纲"],
    id: randomUUID(),
    name: input.name.trim() || "未命名项目",
    updatedAt: now
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO projects (
        id, owner_id, owner_account, name, type, aspect_ratio, cover_image, source, goal, style,
        deliverables_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.ownerId ?? null,
        project.ownerAccount ?? null,
        project.name,
        project.type,
        project.aspectRatio,
        project.coverImage ?? null,
        project.source,
        project.goal,
        project.style,
        JSON.stringify(project.deliverables),
        project.createdAt,
        project.updatedAt
      ]
    );
  });

  return project;
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  const current = await getProject(id);

  if (!current) {
    return null;
  }

  const next: StoredProject = {
    ...current,
    aspectRatio: input.aspectRatio ?? current.aspectRatio,
    coverImage: input.coverImage ?? current.coverImage,
    deliverables: Array.isArray(input.deliverables)
      ? input.deliverables.filter((item) => typeof item === "string")
      : current.deliverables,
    goal: input.goal ?? current.goal,
    name: input.name?.trim() || current.name,
    ownerAccount: input.ownerAccount ?? current.ownerAccount,
    ownerId: input.ownerId ?? current.ownerId,
    source: input.source ?? current.source,
    style: input.style ?? current.style,
    type: input.type ?? current.type,
    updatedAt: new Date().toISOString()
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `UPDATE projects
       SET owner_id = ?, owner_account = ?, name = ?, type = ?, aspect_ratio = ?, cover_image = ?, source = ?,
         goal = ?, style = ?, deliverables_json = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.ownerId ?? null,
        next.ownerAccount ?? null,
        next.name,
        next.type,
        next.aspectRatio,
        next.coverImage ?? null,
        next.source,
        next.goal,
        next.style,
        JSON.stringify(next.deliverables.length ? next.deliverables : ["影视大纲"]),
        next.updatedAt,
        id
      ]
    );
  });

  return next;
}

export async function getProject(id: string) {
  return readDatabase(async (db) => {
    const row = await getFirstRow<ProjectRow>(
      db,
      `SELECT id, owner_id, owner_account, name, type, aspect_ratio, source, goal, style,
        cover_image, deliverables_json, created_at, updated_at
       FROM projects
       WHERE id = ?`,
      [id]
    );

    return row ? mapProject(row) : null;
  });
}

export async function deleteProject(id: string) {
  return writeDatabase(async (db) => {
    // Serialize project deletion with production writes. Every production
    // mutation acquires the same project-row lock before touching child data.
    const lockedProject = await getFirstRow<{ id: string }>(
      db,
      "SELECT id FROM projects WHERE id = ? FOR UPDATE",
      [id]
    );

    if (!lockedProject) {
      return false;
    }

    await deleteProjectProductionData(db, id);
    await db.execute("DELETE FROM project_canvas_states WHERE project_id = ?", [id]);
    await db.execute("DELETE FROM project_uploads WHERE project_id = ?", [id]);
    const result = await db.execute("DELETE FROM projects WHERE id = ?", [id]);

    return result.affectedRows > 0;
  });
}

export async function createProjectUpload(input: CreateProjectUploadInput) {
  const now = new Date().toISOString();
  const upload: ProjectUpload = {
    ...input,
    createdAt: now,
    id: randomUUID()
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO project_uploads (
        id, project_id, owner_id, owner_account, file_name, file_type,
        file_size, storage_path, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        upload.id,
        upload.projectId,
        upload.ownerId ?? null,
        upload.ownerAccount ?? null,
        upload.fileName,
        upload.fileType ?? null,
        upload.fileSize,
        upload.storagePath,
        upload.createdAt
      ]
    );
  });

  return upload;
}

export async function listProjectUploads(projectId: string) {
  return readDatabase(async (db) =>
    (
      await getRows<ProjectUploadRow>(
        db,
        `SELECT id, project_id, owner_id, owner_account, file_name, file_type,
          file_size, storage_path, created_at
         FROM project_uploads
         WHERE project_id = ?
         ORDER BY created_at DESC`,
        [projectId]
      )
    ).map(mapProjectUpload)
  );
}

export async function getProjectUpload(projectId: string, uploadId: string) {
  return readDatabase(async (db) => {
    const row = await getFirstRow<ProjectUploadRow>(
      db,
      `SELECT id, project_id, owner_id, owner_account, file_name, file_type,
        file_size, storage_path, created_at
       FROM project_uploads
       WHERE project_id = ? AND id = ?`,
      [projectId, uploadId]
    );

    return row ? mapProjectUpload(row) : null;
  });
}

export async function deleteProjectUpload(projectId: string, uploadId: string) {
  return writeDatabase(async (db) => {
    const result = await db.execute(
      "DELETE FROM project_uploads WHERE project_id = ? AND id = ?",
      [projectId, uploadId]
    );

    return result.affectedRows > 0;
  });
}

export async function listRecentProjects(limit = 12) {
  return listProjects({ limit });
}

export async function listProjects(filter: ProjectListFilter = {}) {
  const clauses: string[] = [];
  const params: string[] = [];
  const requestedLimit = Number(filter.limit ?? 24);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 80)
    : 24;
  const ownerId = filter.ownerId?.trim();
  const ownerAccount = filter.ownerAccount?.trim();

  if (ownerId) {
    clauses.push("owner_id = ?");
    params.push(ownerId);
  } else if (ownerAccount) {
    clauses.push("owner_account = ?");
    params.push(ownerAccount);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return readDatabase(async (db) =>
    (
      await getRows<ProjectRow>(
      db,
      `SELECT id, owner_id, owner_account, name, type, aspect_ratio, source, goal, style,
        cover_image, deliverables_json, created_at, updated_at
       FROM projects
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      params
      )
    ).map(mapProject)
  );
}
