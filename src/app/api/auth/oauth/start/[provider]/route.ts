import { NextResponse, type NextRequest } from "next/server";

import {
  createOAuthAuthorizationRedirect,
  oauthStateCookieName
} from "@/lib/oauth-login";

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

function publicRequestUrl(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const host =
    forwardedProto && rawHost?.endsWith(":3000")
      ? rawHost.slice(0, -":3000".length)
      : rawHost;
  const proto = forwardedProto || request.nextUrl.protocol.replace(/:$/, "");

  return new URL(
    `${proto}://${host || request.nextUrl.host}${request.nextUrl.pathname}${request.nextUrl.search}`
  );
}

function loginError(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);

  return url;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { provider } = await context.params;
  const requestUrl = publicRequestUrl(request);

  try {
    const result = await createOAuthAuthorizationRedirect(provider, requestUrl);
    const response = NextResponse.redirect(result.authorizationUrl);
    response.cookies.set(oauthStateCookieName(provider), result.stateBinding, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/_wcu-api/auth/oauth/callback",
      sameSite: "lax",
      secure: requestUrl.protocol === "https:"
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      loginError(
        requestUrl.origin,
        error instanceof Error ? error.message : "第三方登录启动失败。"
      )
    );
  }
}
