import {
  getFirstRow,
  readDatabase,
  writeDatabase,
  type Database
} from "@/lib/database";

type ProjectCanvasRow = {
  owner_account: string | null;
  owner_id: string | null;
  project_id: string;
  revision: number;
  state_json: string;
  updated_at: string;
};

export type ProjectCanvasRecord = {
  ownerAccount?: string;
  ownerId?: string;
  projectId: string;
  revision: number;
  state: unknown;
  updatedAt: string;
};

type SaveProjectCanvasInput = {
  expectedRevision: number;
  ownerAccount?: string;
  ownerId?: string;
  projectId: string;
  state: unknown;
};

function mapCanvasRecord(row: ProjectCanvasRow): ProjectCanvasRecord {
  let state: unknown = null;

  try {
    state = JSON.parse(row.state_json);
  } catch {
    state = null;
  }

  return {
    ownerAccount: row.owner_account ?? undefined,
    ownerId: row.owner_id ?? undefined,
    projectId: row.project_id,
    revision: Number(row.revision),
    state,
    updatedAt: row.updated_at
  };
}

async function findCanvasRecord(
  db: Database,
  projectId: string
) {
  const row = await getFirstRow<ProjectCanvasRow>(
    db,
    `SELECT project_id, owner_id, owner_account, state_json, revision, updated_at
     FROM project_canvas_states
     WHERE project_id = ?`,
    [projectId]
  );

  return row ? mapCanvasRecord(row) : null;
}

export async function getProjectCanvas(projectId: string) {
  return readDatabase((db) => findCanvasRecord(db, projectId));
}

export async function saveProjectCanvas(input: SaveProjectCanvasInput) {
  const now = new Date().toISOString();
  const stateJson = JSON.stringify(input.state);

  return writeDatabase(async (db) => {
    const current = await findCanvasRecord(db, input.projectId);

    if (!current) {
      if (input.expectedRevision !== 0) {
        return { current: null, status: "conflict" as const };
      }

      try {
        await db.execute(
          `INSERT INTO project_canvas_states (
            project_id, owner_id, owner_account, state_json, revision, updated_at
           ) VALUES (?, ?, ?, ?, 1, ?)`,
          [
            input.projectId,
            input.ownerId ?? null,
            input.ownerAccount ?? null,
            stateJson,
            now
          ]
        );

        return {
          record: {
            ownerAccount: input.ownerAccount,
            ownerId: input.ownerId,
            projectId: input.projectId,
            revision: 1,
            state: input.state,
            updatedAt: now
          } satisfies ProjectCanvasRecord,
          status: "saved" as const
        };
      } catch (error) {
        if ((error as { code?: string }).code !== "ER_DUP_ENTRY") {
          throw error;
        }

        return {
          current: await findCanvasRecord(db, input.projectId),
          status: "conflict" as const
        };
      }
    }

    if (current.revision !== input.expectedRevision) {
      return { current, status: "conflict" as const };
    }

    const result = await db.execute(
      `UPDATE project_canvas_states
       SET owner_id = ?, owner_account = ?, state_json = ?, revision = revision + 1,
         updated_at = ?
       WHERE project_id = ? AND revision = ?`,
      [
        input.ownerId ?? null,
        input.ownerAccount ?? null,
        stateJson,
        now,
        input.projectId,
        input.expectedRevision
      ]
    );

    if (!result.affectedRows) {
      return {
        current: await findCanvasRecord(db, input.projectId),
        status: "conflict" as const
      };
    }

    return {
      record: {
        ownerAccount: input.ownerAccount,
        ownerId: input.ownerId,
        projectId: input.projectId,
        revision: input.expectedRevision + 1,
        state: input.state,
        updatedAt: now
      } satisfies ProjectCanvasRecord,
      status: "saved" as const
    };
  });
}
