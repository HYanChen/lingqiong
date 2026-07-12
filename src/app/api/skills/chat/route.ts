import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import { LingqiongAccountError } from "@/lib/lingqiong-account";
import { ModelApiUsageLimitError } from "@/lib/model-apis";
import {
  getSkillChatWorkspace,
  listSkillChatMessages,
  listSkillChatSessions,
  sendSkillChatMessage,
  type SendSkillChatInput
} from "@/lib/skill-chat";
import { SkillAccessError } from "@/lib/skill-workbench";

export async function GET(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const url = new URL(request.url);
  const skillId = url.searchParams.get("skillId") || undefined;
  const requestedSessionId = url.searchParams.get("sessionId") || undefined;
  const sessions = await listSkillChatSessions(session, { skillId });
  const selectedSessionId =
    sessions.find((item) => item.id === requestedSessionId)?.id || sessions[0]?.id || "";
  const messages = selectedSessionId
    ? await listSkillChatMessages(session, selectedSessionId)
    : [];

  return NextResponse.json({
    messages,
    ok: true,
    selectedSessionId,
    sessions,
    workspace: getSkillChatWorkspace(session)
  });
}

export async function POST(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const body = (await request.json().catch(() => null)) as SendSkillChatInput | null;

  try {
    const result = await sendSkillChatMessage(body ?? {}, session);

    return NextResponse.json({ ok: true, selectedSessionId: result.session.id, ...result });
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
        message: error instanceof Error ? error.message : "Skill 聊天失败。",
        ok: false
      },
      { status: error instanceof SkillAccessError ? 403 : 400 }
    );
  }
}
