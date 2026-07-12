import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { revokeAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const user = await revokeAdminSession().catch(() => null);

  if (user) {
    await recordAdminAuditSafely({
      action: "admin.logout",
      actor: user,
      request,
      targetId: user.id,
      targetType: "admin_session"
    });
  }

  return NextResponse.json({ ok: true });
}
