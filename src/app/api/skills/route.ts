import { NextResponse } from "next/server";

import { requirePlatformUser } from "@/lib/auth-guards";
import {
  getSkillModelStatus,
  listSkillToolsForSession,
  SkillAccessError,
  upsertUserSkillTool,
  type UpsertSkillInput
} from "@/lib/skill-workbench";

export async function GET() {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  return NextResponse.json({
    modelStatus: await getSkillModelStatus(),
    ok: true,
    skills: await listSkillToolsForSession(session, { activeOnly: true })
  });
}

export async function POST(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const body = (await request.json().catch(() => null)) as UpsertSkillInput | null;

  if (typeof body?.displayName !== "string" || !body.displayName.trim()) {
    return NextResponse.json({ message: "请填写 Skill 名称。" }, { status: 400 });
  }

  try {
    const skill = await upsertUserSkillTool(
      {
        ...body,
        visibility: body.visibility === "public" ? "public" : "private"
      },
      session
    );

    return NextResponse.json({ ok: true, skill });
  } catch (error) {
    if (error instanceof SkillAccessError) {
      return NextResponse.json(
        { message: error.message, ok: false },
        { status: 403 }
      );
    }

    throw error;
  }
}
