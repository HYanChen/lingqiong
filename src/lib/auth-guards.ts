import { NextResponse } from "next/server";

import { getPlatformSession, type PlatformSessionUser } from "@/lib/platform-auth";

export async function requirePlatformUser(): Promise<
  | { response: NextResponse; session: null }
  | { response: null; session: PlatformSessionUser }
> {
  const session = await getPlatformSession();

  if (!session) {
    return {
      response: NextResponse.json(
        { message: "请先登录后再访问。", ok: false },
        { status: 401 }
      ),
      session: null
    };
  }

  return { response: null, session };
}

export function forbiddenResponse(message = "无权访问该资源。") {
  return NextResponse.json({ message, ok: false }, { status: 403 });
}
