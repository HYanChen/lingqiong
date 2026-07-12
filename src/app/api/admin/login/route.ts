import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { setAdminSession } from "@/lib/admin-auth";
import { authenticateAdminUser } from "@/lib/admin-users";

type LoginBody = {
  password?: string;
  username?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const username = body?.username?.trim().toLowerCase();

  if (!body?.password) {
    return NextResponse.json({ message: "请输入管理员密码" }, { status: 400 });
  }

  try {
    const user = await authenticateAdminUser({
      password: body.password,
      username
    });

    if (!user) {
      await recordAdminAuditSafely({
        action: "admin.login",
        actorUsername: username,
        details: { reason: "invalid_credentials" },
        request,
        success: false,
        targetType: "admin_session"
      });

      return NextResponse.json({ message: "账号或密码不正确" }, { status: 401 });
    }

    await setAdminSession(user);
    await recordAdminAuditSafely({
      action: "admin.login",
      actor: user,
      request,
      targetId: user.id,
      targetType: "admin_session"
    });

    return NextResponse.json({
      ok: true,
      user: {
        displayName: user.displayName,
        id: user.id,
        permissions: user.permissions,
        role: user.role,
        username: user.username
      }
    });
  } catch {
    return NextResponse.json(
      { message: "管理员登录服务暂时不可用" },
      { status: 503 }
    );
  }
}
