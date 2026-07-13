import { NextResponse } from "next/server";

import { getLoginSettings } from "@/lib/login-settings";
import { createWechatLoginTicket } from "@/lib/wechat-login";

function publicOrigin(request: Request) {
  const headers = request.headers;
  const proto = headers.get("x-forwarded-proto") || "https";
  const host = headers.get("x-forwarded-host") || headers.get("host");

  return host ? `${proto}://${host.replace(/:3000$/, "")}` : new URL(request.url).origin;
}

export async function POST(request: Request) {
  const settings = await getLoginSettings();

  if (
    !settings.wechat.enabled ||
    (settings.wechat.mode !== "official" &&
      process.env.WCU_ENABLE_LOCAL_SCAN_LOGIN !== "true")
  ) {
    return NextResponse.json(
      { message: "微信登录暂未开启。", ok: false },
      { status: 403 }
    );
  }

  const ticket = await createWechatLoginTicket();
  const origin = publicOrigin(request);
  const scanUrl =
    settings.wechat.mode === "official"
      ? `${origin}/_wcu-api/auth/wechat/start?ticket=${encodeURIComponent(ticket.code)}`
      : `${origin}/wechat-login?ticket=${encodeURIComponent(ticket.code)}`;

  return NextResponse.json({
    ok: true,
    scanUrl,
    ticket: {
      code: ticket.code,
      expiresAt: ticket.expiresAt,
      status: ticket.status
    }
  });
}
