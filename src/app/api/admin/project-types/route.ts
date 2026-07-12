import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  deleteProjectType,
  listProjectTypes,
  upsertProjectType
} from "@/lib/project-types";

type ProjectTypeBody = {
  active?: boolean;
  category?: string;
  description?: string;
  id?: string;
  label?: string;
  sortOrder?: number;
};

export async function GET() {
  const authorization = await authorizeAdmin("projects.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  return NextResponse.json({
    ok: true,
    types: await listProjectTypes()
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin("projects.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const body = (await request.json().catch(() => null)) as ProjectTypeBody | null;

  if (!body?.label?.trim()) {
    return NextResponse.json({ message: "请填写类型名称。" }, { status: 400 });
  }

  const type = await upsertProjectType(body);
  await recordAdminAuditSafely({
    action: body.id ? "project_type.update" : "project_type.create",
    actor: authorization.user,
    details: { category: type.category, label: type.label },
    request,
    targetId: type.id,
    targetType: "project_type"
  });

  return NextResponse.json({ ok: true, type });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdmin("projects.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return NextResponse.json({ message: "缺少类型 ID。" }, { status: 400 });
  }

  const deleted = await deleteProjectType(body.id);

  if (!deleted) {
    return NextResponse.json({ message: "类型不存在。" }, { status: 404 });
  }

  await recordAdminAuditSafely({
    action: "project_type.delete",
    actor: authorization.user,
    request,
    targetId: body.id,
    targetType: "project_type"
  });

  return NextResponse.json({ ok: true });
}
