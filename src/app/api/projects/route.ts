import { NextResponse } from "next/server";

import { createProject, listRecentProjects } from "@/lib/projects";

type ProjectBody = {
  deliverables?: string[];
  goal?: string;
  name?: string;
  ownerAccount?: string;
  ownerId?: string;
  source?: string;
  style?: string;
  type?: string;
};

export async function GET() {
  return NextResponse.json({ projects: await listRecentProjects() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ProjectBody | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ message: "请填写项目名称。", ok: false }, { status: 400 });
  }

  const project = await createProject({
    deliverables: Array.isArray(body.deliverables) ? body.deliverables : [],
    goal: body.goal ?? "",
    name: body.name,
    ownerAccount: body.ownerAccount,
    ownerId: body.ownerId,
    source: body.source ?? "",
    style: body.style ?? "",
    type: body.type ?? "战纪宇宙"
  });

  return NextResponse.json({ ok: true, project });
}
