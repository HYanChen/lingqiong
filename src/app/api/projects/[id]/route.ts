import { NextResponse } from "next/server";

import { getProject } from "@/lib/projects";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ message: "项目不存在。", ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true, project });
}
