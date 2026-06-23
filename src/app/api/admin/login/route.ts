import { NextResponse } from "next/server";

import { isValidPassword, setAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as null | {
    password?: string;
  };

  if (!body?.password || !isValidPassword(body.password)) {
    return NextResponse.json({ message: "密码不正确" }, { status: 401 });
  }

  await setAdminSession();

  return NextResponse.json({ ok: true });
}
