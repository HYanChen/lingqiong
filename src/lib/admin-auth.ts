import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies, headers } from "next/headers";

import {
  canAccess,
  allAdminPermissions,
  isAdminPermission,
  isAdminRole,
  type AdminPermission,
  type AdminRole
} from "@/lib/admin-permissions";
import {
  getAdminUserById,
  revokeAdminUserSessions,
  type PublicAdminUser
} from "@/lib/admin-users";

const COOKIE_NAME = "wcu_admin";
const SESSION_MAX_AGE = 60 * 60 * 12;

type AdminSessionPayload = {
  adminId: string;
  exp: number;
  iat: number;
  permissions: AdminPermission[];
  role: AdminRole;
  version: string;
};

export type AdminAuthorization =
  | {
      ok: true;
      user: PublicAdminUser;
    }
  | {
      message: string;
      ok: false;
      status: 401 | 403 | 503;
    };

function adminSecret() {
  return (
    process.env.ADMIN_SECRET ||
    process.env.PLATFORM_AUTH_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "zhanji2026"
  );
}

function shouldUseSecureCookie() {
  if (process.env.ADMIN_COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.ADMIN_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

function signPayload(payload: string) {
  return createHmac("sha256", adminSecret()).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function getJeecgServiceUser(): Promise<PublicAdminUser | null> {
  const expected = process.env.JEECG_SERVICE_SECRET?.trim();

  if (!expected) {
    return null;
  }

  const actual = (await headers()).get("x-lingqiong-service-secret")?.trim();

  if (!actual || !signaturesMatch(actual, expected)) {
    return null;
  }

  return {
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    displayName: "JeecgBoot 服务",
    id: "jeecg-service",
    lastLoginAt: null,
    permissions: allAdminPermissions,
    role: "owner",
    updatedAt: "2026-01-01T00:00:00.000Z",
    username: "jeecg-service"
  };
}

function createAdminToken(user: PublicAdminUser) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      adminId: user.id,
      exp: now + SESSION_MAX_AGE,
      iat: now,
      permissions: user.permissions,
      role: user.role,
      version: user.updatedAt
    } satisfies AdminSessionPayload),
    "utf8"
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

function parseAdminToken(token?: string): AdminSessionPayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2 || !signaturesMatch(parts[1], signPayload(parts[0]))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8")
    ) as Partial<AdminSessionPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof parsed.adminId !== "string" ||
      !parsed.adminId ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= now ||
      typeof parsed.iat !== "number" ||
      parsed.iat > now + 300 ||
      typeof parsed.version !== "string" ||
      !parsed.version ||
      typeof parsed.role !== "string" ||
      !isAdminRole(parsed.role) ||
      !Array.isArray(parsed.permissions) ||
      !parsed.permissions.every(
        (permission) =>
          typeof permission === "string" && isAdminPermission(permission)
      )
    ) {
      return null;
    }

    return parsed as AdminSessionPayload;
  } catch {
    return null;
  }
}

function permissionsMatch(
  sessionPermissions: AdminPermission[],
  currentPermissions: AdminPermission[]
) {
  if (sessionPermissions.length !== currentPermissions.length) {
    return false;
  }

  const current = new Set(currentPermissions);
  return sessionPermissions.every((permission) => current.has(permission));
}

export async function setAdminSession(user: PublicAdminUser) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createAdminToken(user), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "strict",
    secure: shouldUseSecureCookie()
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: shouldUseSecureCookie()
  });
}

export async function getAdminSession() {
  const serviceUser = await getJeecgServiceUser();

  if (serviceUser) {
    return serviceUser;
  }

  const cookieStore = await cookies();
  const payload = parseAdminToken(cookieStore.get(COOKIE_NAME)?.value);

  if (!payload) {
    return null;
  }

  const user = await getAdminUserById(payload.adminId, { includeInactive: true });

  if (
    !user?.active ||
    user.updatedAt !== payload.version ||
    user.role !== payload.role ||
    !permissionsMatch(payload.permissions, user.permissions)
  ) {
    return null;
  }

  return user;
}

export async function hasAdminSession() {
  try {
    return Boolean(await getAdminSession());
  } catch {
    return false;
  }
}

export async function authorizeAdmin(
  permission: AdminPermission
): Promise<AdminAuthorization> {
  try {
    const user = await getAdminSession();

    if (!user) {
      return { message: "未登录", ok: false, status: 401 };
    }

    if (!canAccess(user, permission)) {
      return { message: "无权执行此操作", ok: false, status: 403 };
    }

    return { ok: true, user };
  } catch {
    return {
      message: "管理员身份服务暂时不可用",
      ok: false,
      status: 503
    };
  }
}

export async function authorizeAdminOwner(): Promise<AdminAuthorization> {
  const authorization = await authorizeAdmin("users.write");

  if (!authorization.ok) {
    return authorization;
  }

  if (authorization.user.role !== "owner") {
    return { message: "仅所有者可执行此操作", ok: false, status: 403 };
  }

  return authorization;
}

export async function revokeAdminSession() {
  let user: PublicAdminUser | null = null;

  try {
    user = await getAdminSession();

    if (user) {
      await revokeAdminUserSessions(user.id);
    }
  } finally {
    await clearAdminSession();
  }

  return user;
}
