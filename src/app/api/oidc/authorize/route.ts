import { NextResponse } from "next/server";

import {
  createOidcAuthorizationCode,
  isAllowedOidcRedirectUri,
  oidcClaimsFromSession,
  oidcClientId,
  oidcPublicBaseUrl,
  publicOidcPath
} from "@/lib/oidc-provider";
import {
  clearPlatformSession,
  getPlatformSession
} from "@/lib/platform-auth";
import { safeInternalRedirectPath } from "@/lib/safe-redirect";

function publicAuthorizePath(url: URL) {
  return `${new URL(publicOidcPath("/authorize")).pathname}${url.search}`;
}

function isNewApiRedirect(redirectUri: string) {
  try {
    const candidate = new URL(redirectUri);
    const publicBase = new URL(oidcPublicBaseUrl());

    return (
      candidate.origin === publicBase.origin &&
      candidate.pathname === "/oauth/oidc"
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const responseType = url.searchParams.get("response_type") ?? "";

  if (
    clientId !== oidcClientId() ||
    responseType !== "code" ||
    !isAllowedOidcRedirectUri(redirectUri)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const session = await getPlatformSession();

  if (!session) {
    const loginUrl = new URL("/login", oidcPublicBaseUrl());
    loginUrl.searchParams.set("next", publicAuthorizePath(url));

    return NextResponse.redirect(loginUrl);
  }

  // The New API user console is a creator surface. A legacy administrator
  // platform session must never be exchanged for, or bound to, a privileged
  // New API account. Require a real front-user session before continuing.
  if (
    isNewApiRedirect(redirectUri) &&
    (session.role !== "creator" || session.source === "admin" || !session.id)
  ) {
    await clearPlatformSession();
    const loginUrl = new URL("/login", oidcPublicBaseUrl());
    loginUrl.searchParams.set("next", publicAuthorizePath(url));
    loginUrl.searchParams.set("reason", "creator_account_required");

    return NextResponse.redirect(loginUrl);
  }

  const claims = oidcClaimsFromSession(session);
  const code = await createOidcAuthorizationCode({
    ...claims,
    nonce: url.searchParams.get("nonce") ?? undefined,
    redirectUri
  });
  const redirectUrl = new URL(redirectUri);
  const state = url.searchParams.get("state");
  const returnTo = safeInternalRedirectPath(
    url.searchParams.get("return_to"),
    ""
  );

  redirectUrl.searchParams.set("code", code);

  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  if (returnTo) {
    redirectUrl.searchParams.set("redirect", returnTo);
  }

  return NextResponse.redirect(redirectUrl);
}
