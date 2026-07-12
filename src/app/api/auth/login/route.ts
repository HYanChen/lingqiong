import { NextResponse } from "next/server";

import { authenticateFrontUser } from "@/lib/front-users";
import { platformUserFromFrontUser, setPlatformSession } from "@/lib/platform-auth";

type LoginBody = {
  account?: string;
  password?: string;
  username?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const username = (body?.username || body?.account)?.trim();

  if (!username || !body?.password) {
    return NextResponse.json(
      { message: "请输入账号和密码。", ok: false },
      { status: 400 }
    );
  }

  if (username.length > 64 || body.password.length > 128) {
    return NextResponse.json(
      { message: "账号或密码不正确。", ok: false },
      { status: 401 }
    );
  }

  try {
    const user = await authenticateFrontUser({
      password: body.password,
      username
    });

    if (!user) {
      return NextResponse.json(
        { message: "账号或密码不正确。", ok: false },
        { status: 401 }
      );
    }

    await setPlatformSession(platformUserFromFrontUser(user));

    return NextResponse.json({
      ok: true,
      user: {
        account: user.account,
        contact: user.contact,
        createdAt: user.createdAt,
        id: user.id,
        inviteCode: user.inviteCode,
        profile: user.profile,
        role: "creator",
        source: user.source
      }
    });
  } catch {
    return NextResponse.json(
      { message: "登录服务暂时不可用，请稍后重试。", ok: false },
      { status: 503 }
    );
  }
}
