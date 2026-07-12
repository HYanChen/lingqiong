import { NextResponse, type NextRequest } from "next/server";

import { completeOAuthLogin, oauthStateCookieName } from "@/lib/oauth-login";

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

function loginUrl(requestUrl: URL, message: string) {
  const url = new URL("/login", requestUrl.origin);
  url.searchParams.set("error", message);

  return url;
}

async function handleCallback(input: {
  code: string | null;
  provider: string;
  request: NextRequest;
  requestUrl: URL;
  state: string | null;
}) {
  const cookieName = oauthStateCookieName(input.provider);

  function consumeBinding(response: NextResponse) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/_wcu-api/auth/oauth/callback",
      sameSite: "lax",
      secure: input.requestUrl.protocol === "https:"
    });
    return response;
  }

  if (!input.code) {
    return consumeBinding(
      NextResponse.redirect(loginUrl(input.requestUrl, "第三方登录没有返回授权码。"))
    );
  }

  try {
    const { next } = await completeOAuthLogin({
      code: input.code,
      providerValue: input.provider,
      requestUrl: input.requestUrl,
      stateBinding: input.request.cookies.get(cookieName)?.value,
      state: input.state
    });

    return consumeBinding(
      NextResponse.redirect(new URL(next, input.requestUrl.origin))
    );
  } catch (error) {
    return consumeBinding(
      NextResponse.redirect(
        loginUrl(
          input.requestUrl,
          error instanceof Error ? error.message : "第三方登录失败，请重新尝试。"
        )
      )
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { provider } = await context.params;
  const requestUrl = publicRequestUrl(request);

  return handleCallback({
    code: requestUrl.searchParams.get("code"),
    provider,
    request,
    requestUrl,
    state: requestUrl.searchParams.get("state")
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { provider } = await context.params;
  const form = await request.formData().catch(() => null);
  const requestUrl = publicRequestUrl(request);

  return handleCallback({
    code: form?.get("code")?.toString() ?? null,
    provider,
    request,
    requestUrl,
    state: form?.get("state")?.toString() ?? null
  });
}
