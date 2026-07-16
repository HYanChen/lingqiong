import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  deleteSkillTool,
  listSkillRuns,
  listSkillTools,
  upsertSkillTool,
  type SkillModule,
  type UpsertSkillInput
} from "@/lib/skill-workbench";

const moduleStatuses = new Set(["可继续生产", "待补材料", "初稿"]);
const moduleAccents = new Set(["green", "amber", "blue", "violet", "slate"]);

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function normalizeModules(value: unknown): SkillModule[] | null {
  if (!Array.isArray(value) || !value.length) return null;

  return value.map((item, index) => {
    const moduleValue = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const title = typeof moduleValue.title === "string" ? moduleValue.title.trim() : "";
    const prompt = typeof moduleValue.prompt === "string" ? moduleValue.prompt.trim() : "";
    if (!title || !prompt) {
      throw new Error(`第 ${index + 1} 个任务模块缺少名称或系统提示词。`);
    }
    const id = typeof moduleValue.id === "string" && moduleValue.id.trim() ? moduleValue.id.trim() : `module-${index + 1}`;
    const accent = typeof moduleValue.accent === "string" && moduleAccents.has(moduleValue.accent) ? moduleValue.accent : "blue";
    const status = typeof moduleValue.status === "string" && moduleStatuses.has(moduleValue.status) ? moduleValue.status : "可继续生产";

    return {
      accent: accent as SkillModule["accent"],
      description: typeof moduleValue.description === "string" ? moduleValue.description.trim() : "",
      id,
      materials: textList(moduleValue.materials),
      nextStep: typeof moduleValue.nextStep === "string" ? moduleValue.nextStep.trim() : "",
      order: typeof moduleValue.order === "string" && moduleValue.order.trim() ? moduleValue.order.trim() : String(index + 1).padStart(2, "0"),
      outputs: textList(moduleValue.outputs),
      prompt,
      reference: typeof moduleValue.reference === "string" ? moduleValue.reference.trim() : "",
      shortTitle: typeof moduleValue.shortTitle === "string" && moduleValue.shortTitle.trim() ? moduleValue.shortTitle.trim() : title,
      status: status as SkillModule["status"],
      title
    };
  });
}

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

  let modules: SkillModule[] | undefined;
  if (body.modules !== undefined) {
    try {
      modules = normalizeModules(body.modules) ?? undefined;
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "任务模块格式错误。" },
        { status: 400 }
      );
    }
    if (!modules?.length) {
      return NextResponse.json({ message: "Skill 至少需要一个任务模块。" }, { status: 400 });
    }
  }

  const skill = await upsertSkillTool({
    ...body,
    modules,
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
