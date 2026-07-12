import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";

export async function GET() {
  try {
    const user = await getAdminSession();

    return NextResponse.json({
      authenticated: Boolean(user),
      user: user
        ? {
            displayName: user.displayName,
            id: user.id,
            permissions: user.permissions,
            role: user.role,
            username: user.username
          }
        : null
    });
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        message: "管理员身份服务暂时不可用",
        user: null
      },
      { status: 503 }
    );
  }
}
