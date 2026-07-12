import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  getLingqiongAccountState,
  LingqiongAccountError
} from "@/lib/lingqiong-account";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requirePlatformUser();

  if (auth.response) {
    return auth.response;
  }

  try {
    const state = await getLingqiongAccountState(auth.session);

    return NextResponse.json({
      ...state,
      links: {
        apiConsole: "/api",
        billing: "/account/billing",
        connect: "/api?redirect=/account",
        credentials: "/keys",
        projects: "/projects",
        usage: "/usage-logs/common"
      },
      ok: true,
      platformUser: {
        account: auth.session.account,
        contact: auth.session.contact ?? "",
        createdAt: auth.session.createdAt,
        id: auth.session.id ?? auth.session.adminId ?? "",
        profile: auth.session.profile ?? "",
        role: auth.session.role,
        source: auth.session.source ?? ""
      }
    });
  } catch (error) {
    if (error instanceof LingqiongAccountError) {
      return NextResponse.json(
        {
          error: { code: error.code, message: error.message },
          message: error.message,
          ok: false,
          rechargeUrl: error.rechargeUrl
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { message: "用户中心暂时不可用，请稍后重试。", ok: false },
      { status: 500 }
    );
  }
}
