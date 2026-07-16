import { createHash } from "node:crypto";

import {
  getFirstRow,
  getRows,
  readDatabase,
  writeDatabase
} from "@/lib/database";

const WINDOW_MS = 15 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;
const VERIFY_QUEUE_TIMEOUT_MS = 2_500;

type LoginScope = "account" | "ip" | "pair";

type LoginThrottleRow = {
  failure_count: number;
  key_hash: string;
  locked_until: string | null;
  scope: LoginScope;
  updated_at: string;
  window_started_at: string;
};

type LoginScopeState = {
  keyHash: string;
  scope: LoginScope;
};

type LoginThrottlePolicy = {
  backoffStartsAt: number;
  hardLimit: number;
};

const policies: Record<LoginScope, LoginThrottlePolicy> = {
  account: { backoffStartsAt: 3, hardLimit: 8 },
  ip: { backoffStartsAt: 8, hardLimit: 20 },
  pair: { backoffStartsAt: 3, hardLimit: 6 }
};

function boundedInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), maximum);
}

const maxConcurrentVerifications = boundedInteger(
  process.env.ADMIN_LOGIN_VERIFY_CONCURRENCY,
  2,
  8
);
const maxQueuedVerifications = boundedInteger(
  process.env.ADMIN_LOGIN_VERIFY_QUEUE,
  12,
  100
);

let activeVerifications = 0;
const verificationQueue: Array<{
  reject: (error: Error) => void;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
}> = [];

export class AdminPasswordVerificationBusyError extends Error {
  constructor() {
    super("Admin password verification capacity is exhausted.");
    this.name = "AdminPasswordVerificationBusyError";
  }
}

function releaseVerificationSlot() {
  const next = verificationQueue.shift();

  if (next) {
    clearTimeout(next.timer);
    next.resolve();
    return;
  }

  activeVerifications = Math.max(activeVerifications - 1, 0);
}

async function acquireVerificationSlot() {
  if (activeVerifications < maxConcurrentVerifications) {
    activeVerifications += 1;
    return;
  }

  if (verificationQueue.length >= maxQueuedVerifications) {
    throw new AdminPasswordVerificationBusyError();
  }

  await new Promise<void>((resolve, reject) => {
    const item = {
      reject,
      resolve,
      timer: setTimeout(() => {
        const index = verificationQueue.indexOf(item);

        if (index >= 0) {
          verificationQueue.splice(index, 1);
        }

        reject(new AdminPasswordVerificationBusyError());
      }, VERIFY_QUEUE_TIMEOUT_MS)
    };

    verificationQueue.push(item);
  });
}

export async function withAdminPasswordVerificationSlot<T>(
  operation: () => Promise<T>
) {
  await acquireVerificationSlot();

  try {
    return await operation();
  } finally {
    releaseVerificationSlot();
  }
}

function normalizeAccount(username: string | undefined) {
  return username?.trim().toLowerCase().slice(0, 191) || "(empty)";
}

function normalizeIp(value: string | null) {
  const candidate = value?.trim().slice(0, 64) || "";

  return /^[0-9a-f:.]+$/iu.test(candidate) ? candidate.toLowerCase() : "unknown";
}

function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] ?? null;

  return normalizeIp(
    request.headers.get("x-wcu-client-ip") ||
      request.headers.get("cf-connecting-ip") ||
      forwarded ||
      request.headers.get("x-real-ip")
  );
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function loginScopes(request: Request, username?: string): LoginScopeState[] {
  const ip = requestIp(request);
  const account = normalizeAccount(username);

  return [
    { keyHash: hashKey(`ip\0${ip}`), scope: "ip" },
    { keyHash: hashKey(`account\0${account}`), scope: "account" },
    { keyHash: hashKey(`pair\0${ip}\0${account}`), scope: "pair" }
  ];
}

function retryAfterSeconds(rows: LoginThrottleRow[], now = Date.now()) {
  return rows.reduce((maximum, row) => {
    const lockedUntil = row.locked_until ? Date.parse(row.locked_until) : 0;

    if (!Number.isFinite(lockedUntil) || lockedUntil <= now) {
      return maximum;
    }

    return Math.max(maximum, Math.ceil((lockedUntil - now) / 1000));
  }, 0);
}

async function readThrottleRows(scopes: LoginScopeState[]) {
  const conditions = scopes.map(() => "(scope = ? AND key_hash = ?)").join(" OR ");
  const params = scopes.flatMap(({ keyHash, scope }) => [scope, keyHash]);

  return readDatabase((db) =>
    getRows<LoginThrottleRow>(
      db,
      `SELECT scope, key_hash, failure_count, window_started_at,
        locked_until, updated_at
       FROM admin_login_throttles
       WHERE ${conditions}`,
      params
    )
  );
}

export async function checkAdminLoginThrottle(request: Request, username?: string) {
  const rows = await readThrottleRows(loginScopes(request, username));
  const seconds = retryAfterSeconds(rows);

  return {
    allowed: seconds === 0,
    retryAfterSeconds: seconds
  };
}

function nextLockDuration(failureCount: number, policy: LoginThrottlePolicy) {
  if (failureCount >= policy.hardLimit) {
    return DEFAULT_LOCK_MS;
  }

  if (failureCount < policy.backoffStartsAt) {
    return 0;
  }

  const exponent = failureCount - policy.backoffStartsAt;

  return Math.min(2 ** exponent * 2_000, 60_000);
}

export async function recordAdminLoginFailure(request: Request, username?: string) {
  const scopes = loginScopes(request, username);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  return writeDatabase(async (db) => {
    let maximumRetryAfter = 0;

    for (const { keyHash, scope } of scopes) {
      await db.execute(
        `INSERT IGNORE INTO admin_login_throttles (
          scope, key_hash, failure_count, window_started_at, locked_until, updated_at
        ) VALUES (?, ?, 0, ?, NULL, ?)`,
        [scope, keyHash, nowIso, nowIso]
      );

      const row = await getFirstRow<LoginThrottleRow>(
        db,
        `SELECT scope, key_hash, failure_count, window_started_at,
          locked_until, updated_at
         FROM admin_login_throttles
         WHERE scope = ? AND key_hash = ?
         FOR UPDATE`,
        [scope, keyHash]
      );
      const windowStarted = row ? Date.parse(row.window_started_at) : 0;
      const withinWindow =
        Number.isFinite(windowStarted) && now - windowStarted <= WINDOW_MS;
      const failureCount = withinWindow ? Number(row?.failure_count ?? 0) + 1 : 1;
      const lockDuration = nextLockDuration(failureCount, policies[scope]);
      const lockedUntil = lockDuration ? new Date(now + lockDuration).toISOString() : null;

      maximumRetryAfter = Math.max(
        maximumRetryAfter,
        lockDuration ? Math.ceil(lockDuration / 1000) : 0
      );

      await db.execute(
        `UPDATE admin_login_throttles
         SET failure_count = ?, window_started_at = ?, locked_until = ?, updated_at = ?
         WHERE scope = ? AND key_hash = ?`,
        [
          failureCount,
          withinWindow ? row?.window_started_at ?? nowIso : nowIso,
          lockedUntil,
          nowIso,
          scope,
          keyHash
        ]
      );
    }

    await db.execute(
      "DELETE FROM admin_login_throttles WHERE updated_at < ?",
      [new Date(now - RETENTION_MS).toISOString()]
    );

    return { retryAfterSeconds: maximumRetryAfter };
  });
}

export async function clearAdminLoginFailures(request: Request, username?: string) {
  const scopes = loginScopes(request, username);
  const conditions = scopes.map(() => "(scope = ? AND key_hash = ?)").join(" OR ");
  const params = scopes.flatMap(({ keyHash, scope }) => [scope, keyHash]);

  await writeDatabase(async (db) => {
    await db.execute(
      `DELETE FROM admin_login_throttles WHERE ${conditions}`,
      params
    );
  });
}
