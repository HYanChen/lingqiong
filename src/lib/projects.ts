import { randomUUID } from "node:crypto";

import { getFirstRow, getRows, readDatabase, writeDatabase } from "@/lib/database";

export type StoredProject = {
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

type ProjectRow = {
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

export type CreateProjectInput = Omit<
  StoredProject,
  "createdAt" | "id" | "updatedAt"
>;

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

export async function createProject(input: CreateProjectInput) {
  const now = new Date().toISOString();
  const project: StoredProject = {
    ...input,
    createdAt: now,
    deliverables: input.deliverables.length ? input.deliverables : ["影视大纲"],
    id: randomUUID(),
    name: input.name.trim() || "未命名项目",
    updatedAt: now
  };

  await writeDatabase((db) => {
    db.run(
      `INSERT INTO projects (
        id, owner_id, owner_account, name, type, source, goal, style,
        deliverables_json, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.ownerId ?? null,
        project.ownerAccount ?? null,
        project.name,
        project.type,
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

export async function getProject(id: string) {
  return readDatabase((db) => {
    const row = getFirstRow<ProjectRow>(
      db,
      `SELECT id, owner_id, owner_account, name, type, source, goal, style,
        deliverables_json, created_at, updated_at
       FROM projects
       WHERE id = ?`,
      [id]
    );

    return row ? mapProject(row) : null;
  });
}

export async function listRecentProjects(limit = 12) {
  return readDatabase((db) =>
    getRows<ProjectRow>(
      db,
      `SELECT id, owner_id, owner_account, name, type, source, goal, style,
        deliverables_json, created_at, updated_at
       FROM projects
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    ).map(mapProject)
  );
}
