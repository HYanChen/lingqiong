import { NextResponse, type NextRequest } from "next/server";

import {
  completeWechatOfficialLogin,
  wechatOfficialStateCookieName
} from "@/lib/wechat-official-login";

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

export async function GET(request: NextRequest) {
  const requestUrl = publicRequestUrl(request);
  const code = requestUrl.searchParams.get("code");

  function consumeBinding(response: NextResponse) {
    response.cookies.set(wechatOfficialStateCookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/_wcu-api/auth/wechat/callback",
      sameSite: "lax",
      secure: requestUrl.protocol === "https:"
    });
    return response;
  }

  if (!code) {
    return consumeBinding(
      NextResponse.redirect(loginUrl(requestUrl, "微信登录没有返回授权码。"))
    );
  }

  try {
    const { next } = await completeWechatOfficialLogin({
      code,
      requestUrl,
      state: requestUrl.searchParams.get("state"),
      stateBinding: request.cookies.get(wechatOfficialStateCookieName)?.value
    });

    return consumeBinding(NextResponse.redirect(new URL(next, requestUrl.origin)));
  } catch (error) {
    return consumeBinding(
      NextResponse.redirect(
        loginUrl(
          requestUrl,
          error instanceof Error ? error.message : "微信登录失败，请重新尝试。"
        )
      )
    );
  }
}
