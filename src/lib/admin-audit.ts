import { randomUUID } from "node:crypto";

import type { PublicAdminUser } from "@/lib/admin-users";
import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase,
  type SqlValue
} from "@/lib/database";

type AuditDetails = Record<string, unknown>;

export type AdminAuditInput = {
  action: string;
  actor?: Pick<PublicAdminUser, "id" | "username"> | null;
  actorUsername?: string | null;
  details?: AuditDetails;
  request?: Request;
  success?: boolean;
  targetId?: string | null;
  targetType?: string | null;
};

type AdminAuditRow = {
  action: string;
  actor_username: string | null;
  admin_user_id: string | null;
  created_at: string;
  details_json: string;
  id: string;
  ip_address: string | null;
  success: number;
  target_id: string | null;
  target_type: string | null;
  user_agent: string | null;
};

export type PublicAdminAuditLog = {
  action: string;
  actorUsername: string | null;
  adminUserId: string | null;
  createdAt: string;
  details: AuditDetails;
  id: string;
  ipAddress: string | null;
  success: boolean;
  targetId: string | null;
  targetType: string | null;
  userAgent: string | null;
};

export type AdminAuditQuery = {
  action?: string;
  actor?: string;
  limit?: number;
  offset?: number;
  success?: boolean;
};

const sensitiveKeyPattern =
  /(authorization|cookie|credential|key|password|secret|token)/i;

function limitText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return "[truncated]";
  }

  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return limitText(value, 1000);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([key, item]) => [
          key,
          sensitiveKeyPattern.test(key)
            ? "[redacted]"
            : sanitizeAuditValue(item, depth + 1)
        ])
    );
  }

  return String(value);
}

function requestIp(request?: Request) {
  return limitText(
    request?.headers.get("x-real-ip")?.trim() || "",
    191
  );
}

function parseAuditDetails(value: string): AuditDetails {
  try {
    const parsed = JSON.parse(value) as unknown;

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as AuditDetails)
      : {};
  } catch {
    return {};
  }
}

function mapAuditLog(row: AdminAuditRow): PublicAdminAuditLog {
  return {
    action: row.action,
    actorUsername: row.actor_username,
    adminUserId: row.admin_user_id,
    createdAt: row.created_at,
    details: parseAuditDetails(row.details_json),
    id: row.id,
    ipAddress: row.ip_address,
    success: Boolean(row.success),
    targetId: row.target_id,
    targetType: row.target_type,
    userAgent: row.user_agent
  };
}

export async function listAdminAudits(query: AdminAuditQuery = {}) {
  const conditions: string[] = [];
  const params: SqlValue[] = [];
  const action = query.action?.trim();
  const actor = query.actor?.trim();
  const limit = Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 200);
  const offset = Math.max(Math.trunc(query.offset ?? 0), 0);

  if (action) {
    conditions.push("action = ?");
    params.push(limitText(action, 191));
  }

  if (actor) {
    conditions.push("actor_username LIKE ?");
    params.push(`%${limitText(actor, 180)}%`);
  }

  if (query.success !== undefined) {
    conditions.push("success = ?");
    params.push(query.success ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return readDatabase(async (db) => {
    const totalRow = await getFirstRow<{ total: number }>(
      db,
      `SELECT COUNT(*) AS total FROM admin_audit_logs ${where}`,
      params
    );
    const rows = await getRows<AdminAuditRow>(
      db,
      `SELECT id, admin_user_id, actor_username, action, target_type, target_id,
        success, ip_address, user_agent, details_json, created_at
       FROM admin_audit_logs
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return {
      logs: rows.map(mapAuditLog),
      total: Number(totalRow?.total ?? 0)
    };
  });
}

export async function recordAdminAudit(input: AdminAuditInput) {
  const actorUsername = limitText(
    input.actor?.username || input.actorUsername?.trim() || "",
    191
  );
  const details = sanitizeAuditValue(input.details ?? {}) as AuditDetails;

  await writeDatabase(async (db) => {
    await db.execute(
      `INSERT INTO admin_audit_logs (
        id, admin_user_id, actor_username, action, target_type, target_id,
        success, ip_address, user_agent, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.actor?.id ?? null,
        actorUsername || null,
        limitText(input.action, 191),
        input.targetType ? limitText(input.targetType, 120) : null,
        input.targetId ? limitText(input.targetId, 191) : null,
        input.success === false ? 0 : 1,
        requestIp(input.request) || null,
        input.request?.headers.get("user-agent")
          ? limitText(input.request.headers.get("user-agent") || "", 512)
          : null,
        JSON.stringify(details),
        new Date().toISOString()
      ]
    );
  });
}

export async function recordAdminAuditSafely(input: AdminAuditInput) {
  try {
    await recordAdminAudit(input);
  } catch (error) {
    console.error("admin audit log failed", error);
  }
}
