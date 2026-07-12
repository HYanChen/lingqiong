import { NextResponse } from "next/server";

import { resolveOidcPostLogoutRedirectUri } from "@/lib/oidc-provider";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri = resolveOidcPostLogoutRedirectUri(
    url.searchParams.get("post_logout_redirect_uri")
  );

  if (!redirectUri) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  return NextResponse.redirect(redirectUri);
}
