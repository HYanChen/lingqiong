import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies, headers } from "next/headers";

import {
  allAdminPermissions,
  isAdminPermission,
  isAdminRole,
  type AdminPermission,
  type AdminRole
} from "@/lib/admin-permissions";
import { getAdminUserById, type PublicAdminUser } from "@/lib/admin-users";
import type { StoredFrontUser } from "@/lib/front-users";

export const platformSessionCookieName = "wcu_platform_session";
const newApiSessionCookieName = "session";

const ONE_DAY = 60 * 60 * 24;
const SESSION_MAX_AGE = ONE_DAY * 7;

export type PlatformRole = "admin" | "creator";

export type PlatformSessionUser = {
  account: string;
  adminId?: string;
  adminPermissions?: AdminPermission[];
  adminRole?: AdminRole;
  adminSessionVersion?: string;
  createdAt: string;
  exp: number;
  role: PlatformRole;
  id?: string;
  contact?: string;
  inviteCode?: string;
  profile?: string;
  source?: string;
};

function authSecret() {
  return (
    process.env.PLATFORM_AUTH_SECRET ||
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "zhanji2026"
  );
}

function shouldUseSecureCookie() {
  return process.env.ADMIN_COOKIE_SECURE === "true";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function signaturesMatch(a: string, b: string) {
  const actual = Buffer.from(a);
  const expected = Buffer.from(b);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function getJeecgServiceSession(): Promise<PlatformSessionUser | null> {
  const expected = process.env.JEECG_SERVICE_SECRET?.trim();

  if (!expected) {
    return null;
  }

  const actual = (await headers()).get("x-lingqiong-service-secret")?.trim();

  if (!actual || !signaturesMatch(actual, expected)) {
    return null;
  }

  return {
    account: "JeecgBoot 服务",
    adminId: "jeecg-service",
    adminPermissions: allAdminPermissions,
    adminRole: "owner",
    adminSessionVersion: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    exp: Math.floor(Date.now() / 1000) + 300,
    id: "jeecg-service",
    profile: "后台内部服务",
    role: "admin",
    source: "admin"
  };
}

function createSessionToken(user: Omit<PlatformSessionUser, "exp">) {
  const payload = base64UrlEncode(
    JSON.stringify({
      ...user,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
    })
  );

  return `${payload}.${signPayload(payload)}`;
}

function parseSessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !signaturesMatch(signature, signPayload(payload))) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as PlatformSessionUser;

    if (
      !parsed.account ||
      (parsed.role !== "admin" && parsed.role !== "creator") ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    if (parsed.role === "admin" || parsed.source === "admin") {
      if (
        parsed.role !== "admin" ||
        parsed.source !== "admin" ||
        typeof parsed.adminId !== "string" ||
        !parsed.adminId ||
        typeof parsed.adminRole !== "string" ||
        !isAdminRole(parsed.adminRole) ||
        typeof parsed.adminSessionVersion !== "string" ||
        !parsed.adminSessionVersion ||
        !Array.isArray(parsed.adminPermissions) ||
        !parsed.adminPermissions.every(
          (permission) =>
            typeof permission === "string" && isAdminPermission(permission)
        )
      ) {
        return null;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

export function platformUserFromFrontUser(
  user: StoredFrontUser,
  role: PlatformRole = "creator"
): Omit<PlatformSessionUser, "exp"> {
  return {
    account: user.account,
    contact: user.contact,
    createdAt: user.createdAt,
    id: user.id,
    inviteCode: user.inviteCode,
    profile: user.profile,
    role,
    source: user.source
  };
}

export function adminPlatformUser(
  admin: PublicAdminUser
): Omit<PlatformSessionUser, "exp"> {
  return {
    account: admin.displayName || admin.username,
    adminId: admin.id,
    adminPermissions: admin.permissions,
    adminRole: admin.role,
    adminSessionVersion: admin.updatedAt,
    createdAt: admin.createdAt,
    id: admin.id,
    profile: "系统管理",
    role: "admin",
    source: "admin"
  };
}

export async function setPlatformSession(user: Omit<PlatformSessionUser, "exp">) {
  const cookieStore = await cookies();
  cookieStore.set(newApiSessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie()
  });
  cookieStore.set(platformSessionCookieName, createSessionToken(user), {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie()
  });
}

export async function clearPlatformSession() {
  const cookieStore = await cookies();
  cookieStore.set(newApiSessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie()
  });
  cookieStore.set(platformSessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie()
  });
}

export async function getPlatformSession() {
  const serviceSession = await getJeecgServiceSession();

  if (serviceSession) {
    return serviceSession;
  }

  const cookieStore = await cookies();
  const session = parseSessionToken(
    cookieStore.get(platformSessionCookieName)?.value
  );

  if (!session || session.source !== "admin") {
    return session;
  }

  try {
    const admin = await getAdminUserById(session.adminId ?? "", {
      includeInactive: true
    });

    if (
      !admin?.active ||
      admin.updatedAt !== session.adminSessionVersion ||
      admin.role !== session.adminRole ||
      !permissionsMatch(admin.permissions, session.adminPermissions ?? [])
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function requirePlatformSession() {
  return getPlatformSession();
}

export function sessionCanAccessOwner(
  session: PlatformSessionUser,
  ownerId?: string,
  _ownerAccount?: string,
  capability: "read" | "write" = "read"
) {
  if (session.source === "admin") {
    return sessionHasAdminPermission(
      session,
      capability === "write" ? "projects.write" : "projects.read"
    );
  }

  return Boolean(ownerId && session.id && ownerId === session.id);
}

function permissionsMatch(
  currentPermissions: AdminPermission[],
  sessionPermissions: AdminPermission[]
) {
  if (currentPermissions.length !== sessionPermissions.length) {
    return false;
  }

  const current = new Set(currentPermissions);
  return sessionPermissions.every((permission) => current.has(permission));
}

export function sessionHasAdminPermission(
  session: PlatformSessionUser,
  permission: AdminPermission
) {
  if (
    session.role !== "admin" ||
    session.source !== "admin" ||
    !session.adminRole ||
    !session.adminPermissions
  ) {
    return false;
  }

  return (
    session.adminRole === "owner" ||
    session.adminPermissions.includes(permission)
  );
}
