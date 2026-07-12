import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  getLoginSettings,
  saveLoginSettings,
  toAdminLoginSettings
} from "@/lib/login-settings";

export async function GET() {
  const authorization = await authorizeAdmin("settings.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  return NextResponse.json(toAdminLoginSettings(await getLoginSettings()));
}

export async function PUT(request: Request) {
  const authorization = await authorizeAdmin("settings.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const body = await request.json().catch(() => null);
  const settings = await saveLoginSettings(body);
  await recordAdminAuditSafely({
    action: "login_settings.update",
    actor: authorization.user,
    request,
    targetId: "default",
    targetType: "login_settings"
  });

  return NextResponse.json({
    ok: true,
    settings: toAdminLoginSettings(settings)
  });
}
