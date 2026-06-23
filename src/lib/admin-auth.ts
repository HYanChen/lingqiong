import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

const COOKIE_NAME = "wcu_admin";
const ONE_DAY = 60 * 60 * 24;

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "zhanji2026";
}

function adminSecret() {
  return process.env.ADMIN_SECRET || adminPassword();
}

export function createAdminToken() {
  return createHash("sha256")
    .update(`${adminPassword()}:${adminSecret()}`)
    .digest("hex");
}

export function isValidPassword(password: string) {
  const expected = Buffer.from(adminPassword());
  const actual = Buffer.from(password);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_DAY,
    path: "/"
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });
}

export async function hasAdminSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;

  return value === createAdminToken();
}
