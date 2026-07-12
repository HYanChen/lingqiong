import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  deleteSkillTool,
  listSkillRuns,
  listSkillTools,
  upsertSkillTool,
  type UpsertSkillInput
} from "@/lib/skill-workbench";

export async function GET() {
  const authorization = await authorizeAdmin("skills.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  return NextResponse.json({
    ok: true,
    runs: await listSkillRuns(20),
    skills: await listSkillTools()
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin("skills.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const body = (await request.json().catch(() => null)) as UpsertSkillInput | null;

  if (!body?.displayName?.trim()) {
    return NextResponse.json({ message: "请填写 Skill 名称。" }, { status: 400 });
  }

  const skill = await upsertSkillTool({
    ...body,
    source: body.source ?? "平台",
    visibility: body.visibility ?? "public"
  });
  await recordAdminAuditSafely({
    action: body.id ? "skill.update" : "skill.create",
    actor: authorization.user,
    details: { displayName: skill.displayName, source: skill.source },
    request,
    targetId: skill.id,
    targetType: "skill"
  });

  return NextResponse.json({ ok: true, skill });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdmin("skills.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return NextResponse.json({ message: "缺少 Skill ID。" }, { status: 400 });
  }

  const deleted = await deleteSkillTool(body.id);

  if (!deleted) {
    return NextResponse.json({ message: "Skill 不存在。" }, { status: 404 });
  }

  await recordAdminAuditSafely({
    action: "skill.delete",
    actor: authorization.user,
    request,
    targetId: body.id,
    targetType: "skill"
  });

  return NextResponse.json({ ok: true });
}
