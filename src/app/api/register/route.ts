import { NextResponse } from "next/server";

import { createFrontUser } from "@/lib/front-users";
import { isValidInviteCode, normalizeInviteCode } from "@/lib/invite-codes";

type RegisterBody = {
  account?: string;
  contact?: string;
  inviteCode?: string;
  profile?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RegisterBody | null;
  const inviteCode = body?.inviteCode;

  if (!inviteCode?.trim()) {
    return NextResponse.json({ message: "请输入邀请码。", ok: false }, { status: 400 });
  }

  if (!(await isValidInviteCode(inviteCode))) {
    return NextResponse.json(
      { message: "邀请码无效或已过期。", ok: false },
      { status: 403 }
    );
  }

  const user = await createFrontUser({
    account: body?.account ?? "受邀创作者",
    contact: body?.contact,
    inviteCode: normalizeInviteCode(inviteCode),
    profile: body?.profile,
    source: "invite"
  });

  return NextResponse.json({ ok: true, user });
}
