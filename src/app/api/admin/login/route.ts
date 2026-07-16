import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { setAdminSession } from "@/lib/admin-auth";
import {
  AdminPasswordVerificationBusyError,
  checkAdminLoginThrottle,
  clearAdminLoginFailures,
  recordAdminLoginFailure
} from "@/lib/admin-login-guard";
import { authenticateAdminUser } from "@/lib/admin-users";

type LoginBody = {
  password?: string;
  username?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const username = body?.username?.trim().toLowerCase();

  if (
    !username ||
    username.length > 191 ||
    !body?.password ||
    body.password.length > 1024
  ) {
    return NextResponse.json(
      { message: "请输入有效的管理员账号和密码" },
      { status: 400 }
    );
  }

  try {
    const throttle = await checkAdminLoginThrottle(request, username);

    if (!throttle.allowed) {
      return NextResponse.json(
        { message: "登录请求过于频繁，请稍后再试" },
        {
          headers: {
            "Retry-After": String(Math.max(throttle.retryAfterSeconds, 1))
          },
          status: 429
        }
      );
    }

    const user = await authenticateAdminUser({
      password: body.password,
      username
    });

    if (!user) {
      await recordAdminLoginFailure(request, username);
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

    await clearAdminLoginFailures(request, username);
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
  } catch (error) {
    if (error instanceof AdminPasswordVerificationBusyError) {
      return NextResponse.json(
        { message: "登录请求过于频繁，请稍后再试" },
        { headers: { "Retry-After": "2" }, status: 429 }
      );
    }

    return NextResponse.json(
      { message: "管理员登录服务暂时不可用" },
      { status: 503 }
    );
  }
}
