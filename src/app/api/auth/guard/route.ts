import { NextResponse } from "next/server";

import {
  getPlatformSession,
  sessionHasAdminPermission
} from "@/lib/platform-auth";

export async function GET() {
  const session = await getPlatformSession();

  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  if (
    session.source === "admin" &&
    !sessionHasAdminPermission(session, "system.read")
  ) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, { status: 204 });
}
