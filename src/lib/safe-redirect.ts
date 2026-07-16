const INTERNAL_URL_BASE = "https://lingqiong.invalid";
const unsafePathPattern = /[\\\u0000-\u001f\u007f]/u;
const frontLoginHandoffPrefixes = ["/_wcu-api/oidc/", "/bookstack"];

export const frontAccountPath = "/account";

function decodedPath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

/**
 * Normalize a user-controlled post-login target to a same-origin path.
 * Backslashes and control characters are rejected before and after decoding
 * because browsers can normalize them into an authority separator.
 */
export function safeInternalRedirectPath(
  value: string | null | undefined,
  fallback: string
) {
  const candidate = value?.trim();

  if (!candidate || unsafePathPattern.test(candidate)) {
    return fallback;
  }

  const decoded = decodedPath(candidate);

  if (
    !decoded ||
    unsafePathPattern.test(decoded) ||
    decoded.startsWith("//") ||
    !decoded.startsWith("/")
  ) {
    return fallback;
  }

  try {
    const base = new URL(INTERNAL_URL_BASE);
    const resolved = new URL(candidate, base);

    if (resolved.origin !== base.origin || !resolved.pathname.startsWith("/")) {
      return fallback;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Front-office sign-in must never become a discoverable shortcut into the
 * administrator area. Keep all valid same-origin targets, including OIDC and
 * BookStack hand-offs, while reserving /admin for its dedicated login flow.
 */
export function safeFrontRedirectPath(
  value: string | null | undefined,
  fallback = frontAccountPath
) {
  const path = safeInternalRedirectPath(value, fallback);
  const decoded = decodedPath(path);
  const pathname = decoded.split(/[?#]/u, 1)[0];

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return fallback;
  }

  return path;
}

/**
 * Successful creator sign-in always lands in the user center. The only
 * exceptions are signed-in protocol hand-offs which must resume immediately
 * (BookStack/OIDC); treating an ordinary `next` value as a post-login target
 * made protected-page redirects bypass the user center and caused the login
 * screen to appear stuck when client navigation raced a refresh.
 */
export function frontLoginDestination(value: string | null | undefined) {
  const path = safeFrontRedirectPath(value, frontAccountPath);
  const decoded = decodedPath(path);
  const pathname = decoded.split(/[?#]/u, 1)[0];

  if (
    frontLoginHandoffPrefixes.some(
      (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)
    )
  ) {
    return path;
  }

  return frontAccountPath;
}
