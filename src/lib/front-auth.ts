export const frontUserStorageKey = "wcu_front_user";
export const frontAuthChangedEvent = "wcu_front_user_changed";

export type FrontUser = {
  account: string;
  createdAt: string;
  role?: "admin" | "creator";
  id?: string;
  contact?: string;
  inviteCode?: string;
  profile?: string;
  source?: "admin" | "apple" | "github" | "google" | "login" | "demo" | "invite" | "wechat";
};

export function readFrontUser(): FrontUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(frontUserStorageKey);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as FrontUser;
  } catch {
    return null;
  }
}

export function writeFrontUser(user: FrontUser) {
  window.localStorage.setItem(frontUserStorageKey, JSON.stringify(user));
  window.dispatchEvent(new Event(frontAuthChangedEvent));
}

export function clearFrontUser() {
  window.localStorage.removeItem(frontUserStorageKey);
  window.dispatchEvent(new Event(frontAuthChangedEvent));
}

export async function fetchFrontUser() {
  const response = await fetch("/_wcu-api/auth/me", { cache: "no-store" });
  const result = (await response.json().catch(() => null)) as null | {
    authenticated?: boolean;
    user?: FrontUser;
  };

  if (response.ok && result?.authenticated && result.user) {
    writeFrontUser(result.user);
    return result.user;
  }

  clearFrontUser();
  return null;
}
