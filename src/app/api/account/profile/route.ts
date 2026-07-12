import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import { updateFrontUserProfile } from "@/lib/front-users";
import {
  platformUserFromFrontUser,
  setPlatformSession
} from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const auth = await requirePlatformUser();

  if (auth.response) {
    return auth.response;
  }

  if (auth.session.source === "admin" || !auth.session.id) {
    return NextResponse.json(
      { message: "当前账号资料由平台统一维护。", ok: false },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { account?: unknown; contact?: unknown; profile?: unknown }
    | null;

  if (
    !body ||
    [body.account, body.contact, body.profile].some(
      (value) => value !== undefined && typeof value !== "string"
    )
  ) {
    return NextResponse.json(
      { message: "个人资料格式不正确。", ok: false },
      { status: 400 }
    );
  }

  try {
    const user = await updateFrontUserProfile(auth.session.id, {
      account: body.account as string | undefined,
      contact: body.contact as string | undefined,
      profile: body.profile as string | undefined
    });

    if (!user) {
      return NextResponse.json(
        { message: "用户不存在。", ok: false },
        { status: 404 }
      );
    }

    await setPlatformSession(platformUserFromFrontUser(user));

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "ACCOUNT_PROFILE_CONFLICT") {
      return NextResponse.json(
        { message: "账号名称或联系方式已被使用。", ok: false },
        { status: 409 }
      );
    }

    if (code === "ACCOUNT_PROFILE_INVALID") {
      return NextResponse.json(
        { message: "个人资料内容不符合要求。", ok: false },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "个人资料保存失败，请稍后重试。", ok: false },
      { status: 500 }
    );
  }
}
