import {
  randomBytes,
  randomUUID,
  scrypt,
  scryptSync,
  timingSafeEqual
} from "node:crypto";

import {
  allAdminPermissions,
  isAdminPermission,
  isAdminRole,
  permissionsForRole,
  type AdminPermission,
  type AdminRole
} from "@/lib/admin-permissions";
import { withAdminPasswordVerificationSlot } from "@/lib/admin-login-guard";
import { getFirstRow, getRows, readDatabase, writeDatabase } from "@/lib/database";

type AdminUserRow = {
  active: number;
  created_at: string;
  display_name: string;
  id: string;
  last_login_at: string | null;
  password_hash: string;
  password_salt: string;
  permissions_json: string;
  role: string;
  updated_at: string;
  username: string;
};

let adminSeedPromise: Promise<void> | null = null;

export type PublicAdminUser = {
  active: boolean;
  createdAt: string;
  displayName: string;
  id: string;
  lastLoginAt: string | null;
  permissions: AdminPermission[];
  role: AdminRole;
  updatedAt: string;
  username: string;
};

export type UpsertAdminUserInput = {
  active?: boolean;
  displayName?: string;
  id?: string;
  password?: string;
  permissions?: string[];
  role?: string;
  username?: string;
};

function defaultAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function defaultAdminPassword() {
  return process.env.ADMIN_PASSWORD || "zhanji2026";
}

function nextTimestamp(previous?: string | null) {
  const previousTime = previous ? Date.parse(previous) : 0;
  const nextTime = Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0);

  return new Date(nextTime).toISOString();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeRole(role?: string): AdminRole {
  return role && isAdminRole(role) ? role : "viewer";
}

function normalizePermissions(values: string[] | undefined, role: AdminRole) {
  if (role === "owner") {
    return allAdminPermissions;
  }

  const next = (values ?? permissionsForRole(role)).filter(isAdminPermission);

  return Array.from(new Set(next));
}

function parsePermissions(value: string, role: AdminRole) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return normalizePermissions(undefined, role);
    }

    return normalizePermissions(
      parsed.filter((item): item is string => typeof item === "string"),
      role
    );
  } catch {
    return normalizePermissions(undefined, role);
  }
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    hash: scryptSync(password, salt, 64).toString("hex"),
    salt
  };
}

function derivePassword(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

async function verifyPassword(password: string, salt: string, hash: string) {
  const actual = await derivePassword(password, salt);
  const expected = Buffer.from(hash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function mapAdminUser(row: AdminUserRow): PublicAdminUser {
  const role = normalizeRole(row.role);

  return {
    active: Boolean(row.active),
    createdAt: row.created_at,
    displayName: row.display_name,
    id: row.id,
    lastLoginAt: row.last_login_at,
    permissions: parsePermissions(row.permissions_json, role),
    role,
    updatedAt: row.updated_at,
    username: row.username
  };
}

function selectAdminUserSql() {
  return `SELECT id, username, display_name, role, permissions_json, active,
    password_hash, password_salt, last_login_at, created_at, updated_at
    FROM admin_users`;
}

export async function ensureAdminUserSchema() {
  adminSeedPromise ??= writeDatabase(async (db) => {
    const row = await getFirstRow<{ total: number }>(
      db,
      "SELECT COUNT(*) AS total FROM admin_users"
    );

    if (Number(row?.total ?? 0) > 0) {
      return;
    }

    const now = new Date().toISOString();
    const password = hashPassword(defaultAdminPassword());

    await db.execute(
      `INSERT IGNORE INTO admin_users (
        id, username, display_name, role, permissions_json, password_hash,
        password_salt, active, last_login_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        normalizeUsername(defaultAdminUsername()),
        "默认所有者",
        "owner",
        JSON.stringify(allAdminPermissions),
        password.hash,
        password.salt,
        1,
        null,
        now,
        now
      ]
    );
  });

  try {
    await adminSeedPromise;
  } catch (error) {
    adminSeedPromise = null;
    throw error;
  }
}

export async function listAdminUsers() {
  await ensureAdminUserSchema();

  return readDatabase(async (db) =>
    (
      await getRows<AdminUserRow>(
      db,
      `${selectAdminUserSql()}
       ORDER BY
         CASE role
           WHEN 'owner' THEN 0
           WHEN 'admin' THEN 1
           WHEN 'editor' THEN 2
           WHEN 'operator' THEN 3
           ELSE 4
         END,
         updated_at DESC`
      )
    ).map(mapAdminUser)
  );
}

export async function getAdminUserById(id: string, options?: { includeInactive?: boolean }) {
  await ensureAdminUserSchema();

  return readDatabase(async (db) => {
    const row = await getFirstRow<AdminUserRow>(
      db,
      `${selectAdminUserSql()}
       WHERE id = ? ${options?.includeInactive ? "" : "AND active = 1"}`,
      [id]
    );

    return row ? mapAdminUser(row) : null;
  });
}

export async function authenticateAdminUser(input: {
  password: string;
  username?: string;
}) {
  return withAdminPasswordVerificationSlot(async () => {
    await ensureAdminUserSchema();

    const username = normalizeUsername(input.username || defaultAdminUsername());
    const row = await readDatabase((db) =>
      getFirstRow<AdminUserRow>(
        db,
        `${selectAdminUserSql()}
         WHERE username = ?`,
        [username]
      )
    );
    const passwordMatches = await verifyPassword(
      input.password,
      row?.password_salt ?? "wcu-admin-login-dummy-salt-v1",
      row?.password_hash ?? Buffer.alloc(64).toString("hex")
    );

    if (!row?.active || !passwordMatches) {
      return null;
    }

    const now = nextTimestamp(row.updated_at);

    await writeDatabase(async (db) => {
      await db.execute("UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?", [
        now,
        now,
        row.id
      ]);
    });

    return {
      ...mapAdminUser(row),
      lastLoginAt: now,
      updatedAt: now
    };
  });
}

export async function upsertAdminUser(input: UpsertAdminUserInput) {
  await ensureAdminUserSchema();

  const id = input.id || randomUUID();

  const existing = input.id
    ? await readDatabase((db) =>
        getFirstRow<AdminUserRow>(
          db,
          `${selectAdminUserSql()}
           WHERE id = ?`,
          [input.id ?? ""]
        )
      )
    : null;
  const now = nextTimestamp(existing?.updated_at);
  const username = normalizeUsername(input.username ?? existing?.username ?? "");

  if (input.id && !existing) {
    throw new Error("管理员不存在。");
  }

  if (!username) {
    throw new Error("请填写管理员账号。");
  }
  const role = normalizeRole(input.role ?? existing?.role);
  const permissions =
    existing && input.permissions === undefined && input.role === undefined
      ? parsePermissions(existing.permissions_json, role)
      : normalizePermissions(input.permissions, role);
  const password =
    input.password?.trim() || !existing
      ? hashPassword(input.password?.trim() || "")
      : {
          hash: existing.password_hash,
          salt: existing.password_salt
        };

  if (!existing && !input.password?.trim()) {
    throw new Error("新管理员必须设置初始密码。");
  }

  const user = {
    active: input.active ?? Boolean(existing?.active ?? true),
    createdAt: existing?.created_at ?? now,
    displayName:
      input.displayName?.trim() ||
      existing?.display_name ||
      username,
    id,
    lastLoginAt: existing?.last_login_at ?? null,
    passwordHash: password.hash,
    passwordSalt: password.salt,
    permissions,
    role,
    updatedAt: now,
    username
  };

  await writeDatabase(async (db) => {
    const activeOwners = await getRows<{ id: string }>(
      db,
      "SELECT id FROM admin_users WHERE active = 1 AND role = 'owner' ORDER BY id FOR UPDATE"
    );
    const lockedExisting = input.id
      ? await getFirstRow<AdminUserRow>(
          db,
          `${selectAdminUserSql()} WHERE id = ? FOR UPDATE`,
          [input.id]
        )
      : null;

    if (input.id && !lockedExisting) {
      throw new Error("管理员不存在。");
    }

    if (
      lockedExisting?.active &&
      normalizeRole(lockedExisting.role) === "owner" &&
      (!user.active || user.role !== "owner") &&
      activeOwners.filter((owner) => owner.id !== lockedExisting.id).length < 1
    ) {
      throw new Error("必须至少保留一个启用中的所有者。");
    }

    await db.execute(
      `INSERT INTO admin_users (
        id, username, display_name, role, permissions_json, password_hash,
        password_salt, active, last_login_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = VALUES(username),
        display_name = VALUES(display_name),
        role = VALUES(role),
        permissions_json = VALUES(permissions_json),
        password_hash = VALUES(password_hash),
        password_salt = VALUES(password_salt),
        active = VALUES(active),
        updated_at = VALUES(updated_at)`,
      [
        user.id,
        user.username,
        user.displayName,
        user.role,
        JSON.stringify(user.permissions),
        user.passwordHash,
        user.passwordSalt,
        user.active ? 1 : 0,
        user.lastLoginAt,
        user.createdAt,
        user.updatedAt
      ]
    );
  });

  return getAdminUserById(user.id, { includeInactive: true });
}

export async function deleteAdminUser(id: string) {
  await ensureAdminUserSchema();

  return writeDatabase(async (db) => {
    const activeOwners = await getRows<{ id: string }>(
      db,
      "SELECT id FROM admin_users WHERE active = 1 AND role = 'owner' ORDER BY id FOR UPDATE"
    );
    const target = await getFirstRow<AdminUserRow>(
      db,
      `${selectAdminUserSql()} WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (!target) {
      return false;
    }

    if (
      target.active &&
      normalizeRole(target.role) === "owner" &&
      activeOwners.filter((owner) => owner.id !== target.id).length < 1
    ) {
      throw new Error("必须至少保留一个启用中的所有者。");
    }

    const result = await db.execute("DELETE FROM admin_users WHERE id = ?", [id]);

    return result.affectedRows > 0;
  });
}

export async function revokeAdminUserSessions(id: string) {
  await ensureAdminUserSchema();

  return writeDatabase(async (db) => {
    const row = await getFirstRow<{ updated_at: string }>(
      db,
      "SELECT updated_at FROM admin_users WHERE id = ?",
      [id]
    );

    if (!row) {
      return false;
    }

    const result = await db.execute(
      "UPDATE admin_users SET updated_at = ? WHERE id = ?",
      [nextTimestamp(row.updated_at), id]
    );

    return result.affectedRows > 0;
  });
}

export async function countActiveOwners(excludeId?: string) {
  await ensureAdminUserSchema();

  return readDatabase(async (db) => {
    const row = await getFirstRow<{ total: number }>(
      db,
      `SELECT COUNT(*) AS total
       FROM admin_users
       WHERE active = 1 AND role = 'owner' ${excludeId ? "AND id != ?" : ""}`,
      excludeId ? [excludeId] : []
    );

    return Number(row?.total ?? 0);
  });
}
