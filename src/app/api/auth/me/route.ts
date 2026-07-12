import { NextResponse } from "next/server";

import { getPlatformSession } from "@/lib/platform-auth";

export async function GET() {
  const user = await getPlatformSession();

  return NextResponse.json({
    authenticated: Boolean(user),
    user: user
      ? {
          account: user.account,
          contact: user.contact,
          createdAt: user.createdAt,
          exp: user.exp,
          id: user.id,
          inviteCode: user.inviteCode,
          profile: user.profile,
          role: user.role,
          source: user.source
        }
      : null
  });
}
