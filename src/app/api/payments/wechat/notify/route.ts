import { NextResponse } from "next/server";

import {
  handleWechatPaymentNotify,
  verifyWechatNotifySignature
} from "@/lib/wechat-pay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyWechatNotifySignature(request.headers, rawBody)) {
    return NextResponse.json({ code: "FAIL", message: "签名验证失败" }, { status: 401 });
  }
  try {
    await handleWechatPaymentNotify(rawBody);
    return NextResponse.json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    console.error("WeChat Pay notification failed", error);
    return NextResponse.json({ code: "FAIL", message: "处理失败" }, { status: 500 });
  }
}
