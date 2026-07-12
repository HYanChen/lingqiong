import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import { normalizeInviteCode } from "@/lib/invite-codes";
import {
  getFirstRow,
  readDatabase,
  writeDatabase,
  type Database
} from "@/lib/database";

export type FrontUserSource =
  | "apple"
  | "github"
  | "google"
  | "login"
  | "demo"
  | "invite"
  | "wechat";

export type FrontUserIdentityProvider = Extract<
  FrontUserSource,
  "apple" | "github" | "google" | "wechat"
>;

export type CreateFrontUserInput = {
  account: string;
  contact?: string;
  inviteCode?: string;
  password?: string;
  profile?: string;
  source: FrontUserSource;
  username?: string;
};

export type CreateFrontUserIdentityInput = {
  account: string;
  contact?: string;
  profile?: string;
  provider: FrontUserIdentityProvider;
  providerSubject: string;
};

export type StoredFrontUser = Omit<
  CreateFrontUserInput,
  "password" | "username"
> & {
  createdAt: string;
  id: string;
};

export type UpdateFrontUserProfileInput = {
  account?: string;
  contact?: string;
  profile?: string;
};

type FrontUserRow = {
  account: string;
  active: number;
  contact: string | null;
  created_at: string;
  failed_attempts: number;
  id: string;
  invite_code: string | null;
  last_login_at: string | null;
  locked_until: string | null;
  password_hash: string | null;
  password_salt: string | null;
  profile: string | null;
  source: FrontUserSource;
  updated_at: string | null;
  username: string | null;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const usernamePattern = /^[\p{L}\p{N}._@+-]{3,64}$/u;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    hash: scryptSync(password, salt, 64).toString("hex"),
    salt
  };
}

const dummyCredentials = hashPassword("wcu-front-auth-dummy-password");

function verifyPassword(password: string, salt: string, hash: string) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(hash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeFrontUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidFrontUsername(username: string) {
  return usernamePattern.test(normalizeFrontUsername(username));
}

function selectFrontUserSql() {
  return `SELECT id, username, account, contact, profile, invite_code, source,
    password_hash, password_salt, active, failed_attempts, locked_until,
    last_login_at, created_at, updated_at
    FROM front_users`;
}

function mapFrontUser(row: FrontUserRow): StoredFrontUser {
  return {
    account: row.account,
    contact: row.contact ?? undefined,
    createdAt: row.created_at,
    id: row.id,
    inviteCode: row.invite_code ?? undefined,
    profile: row.profile ?? undefined,
    source: row.source
  };
}

async function insertFrontUser(db: Database, input: CreateFrontUserInput) {
  const username = input.username
    ? normalizeFrontUsername(input.username)
    : undefined;

  if (Boolean(username) !== Boolean(input.password)) {
    throw new Error("FRONT_CREDENTIALS_INCOMPLETE");
  }

  const user: StoredFrontUser = {
    account: input.account.trim() || "受邀创作者",
    contact: input.contact?.trim(),
    createdAt: new Date().toISOString(),
    id: randomUUID(),
    inviteCode: input.inviteCode
      ? normalizeInviteCode(input.inviteCode)
      : undefined,
    profile: input.profile?.trim(),
    source: input.source
  };
  const credentials = input.password ? hashPassword(input.password) : null;

  await db.execute(
    `INSERT INTO front_users (
      id, username, account, contact, profile, invite_code, source,
      password_hash, password_salt, active, failed_attempts, locked_until,
      last_login_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      username ?? null,
      user.account,
      user.contact ?? null,
      user.profile ?? null,
      user.inviteCode ?? null,
      user.source,
      credentials?.hash ?? null,
      credentials?.salt ?? null,
      1,
      0,
      null,
      null,
      user.createdAt,
      user.createdAt
    ]
  );

  if (user.inviteCode) {
    await db.execute(
      `UPDATE invite_codes
       SET used_count = used_count + 1, updated_at = ?
       WHERE code = ?`,
      [user.createdAt, user.inviteCode]
    );
  }

  return user;
}

export async function createFrontUser(input: CreateFrontUserInput) {
  return writeDatabase((db) => insertFrontUser(db, input));
}

export async function findFrontUserByAccount(account: string) {
  const normalized = account.trim();

  if (!normalized) {
    return null;
  }

  return readDatabase(async (db) => {
    const row = await getFirstRow<FrontUserRow>(
      db,
      `${selectFrontUserSql()}
       WHERE account = ? OR contact = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalized, normalized]
    );

    return row ? mapFrontUser(row) : null;
  });
}

export async function findFrontUserByUsername(username: string) {
  const normalized = normalizeFrontUsername(username);

  if (!normalized) {
    return null;
  }

  return readDatabase(async (db) => {
    const row = await getFirstRow<FrontUserRow>(
      db,
      `${selectFrontUserSql()}
       WHERE username = ?
       LIMIT 1`,
      [normalized]
    );

    return row ? mapFrontUser(row) : null;
  });
}

export async function findFrontUserById(id: string) {
  const normalized = id.trim();

  if (!normalized) {
    return null;
  }

  return readDatabase(async (db) => {
    const row = await getFirstRow<FrontUserRow>(
      db,
      `${selectFrontUserSql()}
       WHERE id = ?
       LIMIT 1`,
      [normalized]
    );

    return row ? mapFrontUser(row) : null;
  });
}

export async function updateFrontUserProfile(
  id: string,
  input: UpdateFrontUserProfileInput
) {
  const existing = await findFrontUserById(id);

  if (!existing) {
    return null;
  }

  const account = input.account?.trim() ?? existing.account;
  const contact = input.contact?.trim() ?? existing.contact ?? "";
  const profile = input.profile?.trim() ?? existing.profile ?? "";

  if (!account || account.length > 255) {
    throw new Error("ACCOUNT_PROFILE_INVALID");
  }

  if (contact.length > 255 || profile.length > 4000) {
    throw new Error("ACCOUNT_PROFILE_INVALID");
  }

  await writeDatabase(async (db) => {
    const duplicate = await getFirstRow<{ id: string }>(
      db,
      `SELECT id FROM front_users
       WHERE id <> ? AND (account = ? OR (? <> '' AND contact = ?))
       LIMIT 1`,
      [id, account, contact, contact]
    );

    if (duplicate) {
      throw new Error("ACCOUNT_PROFILE_CONFLICT");
    }

    await db.execute(
      `UPDATE front_users
       SET account = ?, contact = ?, profile = ?, updated_at = ?
       WHERE id = ?`,
      [account, contact || null, profile || null, new Date().toISOString(), id]
    );
  });

  return findFrontUserById(id);
}

export async function authenticateFrontUser(input: {
  password: string;
  username: string;
}) {
  const username = normalizeFrontUsername(input.username);

  if (!username || !input.password) {
    return null;
  }

  return writeDatabase(async (db) => {
    const row = await getFirstRow<FrontUserRow>(
      db,
      `${selectFrontUserSql()}
       WHERE username = ?
       LIMIT 1
       FOR UPDATE`,
      [username]
    );

    if (!row) {
      verifyPassword(
        input.password,
        dummyCredentials.salt,
        dummyCredentials.hash
      );
      return null;
    }

    const now = new Date();
    const lockedUntil = row.locked_until ? Date.parse(row.locked_until) : 0;
    const locked = Number.isFinite(lockedUntil) && lockedUntil > now.getTime();
    const validCredentials = Boolean(
      row.password_hash &&
        row.password_salt &&
        verifyPassword(input.password, row.password_salt, row.password_hash)
    );

    if (!row.active || locked || !validCredentials) {
      if (row.active && !locked) {
        const failedAttempts = row.failed_attempts + 1;
        const nextLockedUntil =
          failedAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(now.getTime() + LOCK_DURATION_MS).toISOString()
            : null;

        await db.execute(
          `UPDATE front_users
           SET failed_attempts = ?, locked_until = ?, updated_at = ?
           WHERE id = ?`,
          [failedAttempts, nextLockedUntil, now.toISOString(), row.id]
        );
      }

      return null;
    }

    await db.execute(
      `UPDATE front_users
       SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
       WHERE id = ?`,
      [now.toISOString(), now.toISOString(), row.id]
    );

    return mapFrontUser(row);
  });
}

export async function findOrCreateFrontUserIdentityInDatabase(
  db: Database,
  input: CreateFrontUserIdentityInput
) {
  const subject = input.providerSubject.trim();

  if (!subject) {
    throw new Error("FRONT_IDENTITY_SUBJECT_REQUIRED");
  }

  const existing = await getFirstRow<FrontUserRow>(
    db,
    `SELECT front_users.id, front_users.username, front_users.account,
       front_users.contact, front_users.profile, front_users.invite_code,
       front_users.source, front_users.password_hash, front_users.password_salt,
       front_users.active, front_users.failed_attempts, front_users.locked_until,
       front_users.last_login_at, front_users.created_at, front_users.updated_at
     FROM front_users
     INNER JOIN front_user_identities identity ON identity.user_id = front_users.id
     WHERE identity.provider = ? AND identity.provider_subject = ?
     LIMIT 1`,
    [input.provider, subject]
  );

  if (existing) {
    return mapFrontUser(existing);
  }

  const user = await insertFrontUser(db, {
    account: input.account,
    contact: input.contact,
    profile: input.profile,
    source: input.provider
  });
  const now = user.createdAt;

  await db.execute(
    `INSERT INTO front_user_identities (
      id, provider, provider_subject, user_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), input.provider, subject, user.id, now, now]
  );

  return user;
}

export async function findOrCreateFrontUserIdentity(
  input: CreateFrontUserIdentityInput
) {
  return writeDatabase((db) =>
    findOrCreateFrontUserIdentityInDatabase(db, input)
  );
}
