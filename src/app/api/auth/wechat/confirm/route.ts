import { NextResponse } from "next/server";

import { getLoginSettings } from "@/lib/login-settings";
import { confirmWechatLoginTicket } from "@/lib/wechat-login";

type ConfirmBody = {
  account?: string;
  contact?: string;
  ticket?: string;
};

export async function POST(request: Request) {
  const settings = await getLoginSettings();

  if (
    !settings.wechat.enabled ||
    process.env.WCU_ENABLE_LOCAL_SCAN_LOGIN !== "true"
  ) {
    return NextResponse.json(
      { message: "微信登录暂未开启。", ok: false },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as ConfirmBody | null;
  const ticketCode = body?.ticket?.trim();

  if (!ticketCode) {
    return NextResponse.json({ message: "缺少登录票据。", ok: false }, { status: 400 });
  }

  const ticket = await confirmWechatLoginTicket({
    account: body?.account || settings.wechat.defaultAccount,
    code: ticketCode,
    contact: body?.contact || settings.wechat.defaultContact
  });

  if (!ticket) {
    return NextResponse.json({ message: "二维码已失效。", ok: false }, { status: 404 });
  }

  if (ticket.status === "expired") {
    return NextResponse.json({ message: "二维码已过期，请刷新重试。", ok: false }, { status: 410 });
  }

  return NextResponse.json({
    ok: true,
    ticket: {
      code: ticket.code,
      status: ticket.status
    }
  });
}
