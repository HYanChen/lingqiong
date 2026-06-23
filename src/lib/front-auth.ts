export const frontUserStorageKey = "wcu_front_user";
export const frontAuthChangedEvent = "wcu_front_user_changed";

export type FrontUser = {
  account: string;
  createdAt: string;
  id?: string;
  contact?: string;
  inviteCode?: string;
  profile?: string;
  source?: "login" | "demo" | "invite";
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
