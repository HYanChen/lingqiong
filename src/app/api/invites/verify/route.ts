import { NextRequest, NextResponse } from "next/server";

import { isValidInviteCode, normalizeInviteCode } from "@/lib/invite-codes";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const inviteCode =
    typeof body === "object" && body !== null && "inviteCode" in body
      ? body.inviteCode
      : null;

  if (typeof inviteCode !== "string" || !inviteCode.trim()) {
    return NextResponse.json(
      { message: "请输入邀请码。", ok: false },
      { status: 400 }
    );
  }

  if (!(await isValidInviteCode(inviteCode))) {
    return NextResponse.json(
      { message: "邀请码无效或已过期。", ok: false },
      { status: 403 }
    );
  }

  return NextResponse.json({
    inviteCode: normalizeInviteCode(inviteCode),
    ok: true
  });
}
