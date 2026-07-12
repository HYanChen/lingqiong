import { NextResponse } from "next/server";

import { getLoginSettings } from "@/lib/login-settings";
import { platformUserFromFrontUser, setPlatformSession } from "@/lib/platform-auth";
import { consumeWechatLoginTicket, getWechatLoginTicket } from "@/lib/wechat-login";

export async function GET(request: Request) {
  const settings = await getLoginSettings();

  if (!settings.wechat.enabled) {
    return NextResponse.json(
      { message: "微信登录暂未开启。", ok: false },
      { status: 403 }
    );
  }

  const ticketCode = new URL(request.url).searchParams.get("ticket")?.trim();

  if (!ticketCode) {
    return NextResponse.json({ message: "缺少登录票据。", ok: false }, { status: 400 });
  }

  const current = await getWechatLoginTicket(ticketCode);

  if (!current) {
    return NextResponse.json({ message: "二维码已失效。", ok: false }, { status: 404 });
  }

  if (current.status !== "confirmed") {
    return NextResponse.json({
      ok: true,
      ticket: {
        code: current.code,
        expiresAt: current.expiresAt,
        status: current.status
      }
    });
  }

  const { ticket, user } = await consumeWechatLoginTicket({
    code: ticketCode,
    fallbackAccount: settings.wechat.defaultAccount,
    fallbackContact: settings.wechat.defaultContact
  });

  if (user) {
    await setPlatformSession(platformUserFromFrontUser(user));
  }

  return NextResponse.json({
    ok: true,
    ticket: ticket
      ? {
          code: ticket.code,
          expiresAt: ticket.expiresAt,
          status: ticket.status
        }
      : null,
    user
  });
}
