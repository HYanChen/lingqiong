import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import { LingqiongAccountError } from "@/lib/lingqiong-account";
import { ModelApiUsageLimitError } from "@/lib/model-apis";
import { runSkill, SkillAccessError } from "@/lib/skill-workbench";

export async function POST(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const body = await request.json().catch(() => null);

  try {
    const run = await runSkill(body ?? {}, session);

    return NextResponse.json({ ok: true, run });
  } catch (error) {
    if (error instanceof LingqiongAccountError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            rechargeUrl: error.rechargeUrl
          },
          message: error.message,
          ok: false,
          rechargeUrl: error.rechargeUrl
        },
        { status: error.status }
      );
    }

    if (error instanceof ModelApiUsageLimitError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            retryAfterSeconds: error.retryAfterSeconds
          },
          message: error.message,
          ok: false
        },
        {
          headers: { "Retry-After": String(error.retryAfterSeconds) },
          status: 429
        }
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Skill 运行失败。",
        ok: false
      },
      { status: error instanceof SkillAccessError ? 403 : 400 }
    );
  }
}
