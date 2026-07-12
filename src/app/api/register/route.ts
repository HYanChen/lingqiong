import { NextResponse } from "next/server";

import {
  createFrontUser,
  findFrontUserByUsername,
  isValidFrontUsername,
  normalizeFrontUsername
} from "@/lib/front-users";
import { isValidInviteCode, normalizeInviteCode } from "@/lib/invite-codes";
import { platformUserFromFrontUser, setPlatformSession } from "@/lib/platform-auth";

type RegisterBody = {
  account?: string;
  contact?: string;
  inviteCode?: string;
  password?: string;
  passwordConfirm?: string;
  profile?: string;
  username?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RegisterBody | null;
  const inviteCode = body?.inviteCode;
  const account = body?.account?.trim() ?? "";
  const username = normalizeFrontUsername(body?.username ?? "");
  const password = body?.password ?? "";

  if (!inviteCode?.trim()) {
    return NextResponse.json({ message: "请输入邀请码。", ok: false }, { status: 400 });
  }

  if (!(await isValidInviteCode(inviteCode))) {
    return NextResponse.json(
      { message: "邀请码无效或已过期。", ok: false },
      { status: 403 }
    );
  }

  if (!isValidFrontUsername(username)) {
    return NextResponse.json(
      { message: "登录账号需为 3–64 位中文、字母、数字或 . _ @ + -。", ok: false },
      { status: 400 }
    );
  }

  if (!account || account.length > 255) {
    return NextResponse.json(
      { message: "请填写创作者名称（不超过 255 个字符）。", ok: false },
      { status: 400 }
    );
  }

  if ((body?.contact?.trim().length ?? 0) > 255) {
    return NextResponse.json(
      { message: "联系方式不能超过 255 个字符。", ok: false },
      { status: 400 }
    );
  }

  if (password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { message: "密码长度需为 8–128 位。", ok: false },
      { status: 400 }
    );
  }

  if (password !== body?.passwordConfirm) {
    return NextResponse.json(
      { message: "两次输入的密码不一致。", ok: false },
      { status: 400 }
    );
  }

  if (await findFrontUserByUsername(username)) {
    return NextResponse.json(
      { message: "该登录账号已被使用。", ok: false },
      { status: 409 }
    );
  }

  try {
    const user = await createFrontUser({
      account,
      contact: body?.contact,
      inviteCode: normalizeInviteCode(inviteCode),
      password,
      profile: body?.profile,
      source: "invite",
      username
    });
    await setPlatformSession(platformUserFromFrontUser(user));

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "该登录账号已被使用。", ok: false },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "注册服务暂时不可用，请稍后重试。", ok: false },
      { status: 503 }
    );
  }
}
