import { NextResponse } from "next/server";

import { createProject, listProjects } from "@/lib/projects";
import { forbiddenResponse, requirePlatformUser } from "@/lib/auth-guards";
import { sessionHasAdminPermission } from "@/lib/platform-auth";
import {
  ProjectInputError,
  readProjectMutationInput
} from "@/lib/project-input";

export async function GET(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 24);
  const isAdminSession = session.source === "admin";

  if (isAdminSession && !sessionHasAdminPermission(session, "projects.read")) {
    return forbiddenResponse("无权查看项目列表。");
  }

  return NextResponse.json({
    ok: true,
    projects: await listProjects(
      isAdminSession ? { limit } : { limit, ownerId: session.id }
    )
  });
}

export async function POST(request: Request) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  if (
    session.source === "admin" &&
    !sessionHasAdminPermission(session, "projects.write")
  ) {
    return forbiddenResponse("无权创建项目。");
  }

  let body;

  try {
    body = await readProjectMutationInput(request, { creating: true });
  } catch (error) {
    if (error instanceof ProjectInputError) {
      return NextResponse.json(
        { message: error.message, ok: false },
        { status: error.status }
      );
    }

    throw error;
  }

  const project = await createProject({
    aspectRatio: body.aspectRatio ?? "9:16",
    coverImage: body.coverImage,
    deliverables: body.deliverables ?? [],
    goal: body.goal ?? "",
    name: body.name ?? "",
    ownerAccount: session.account,
    ownerId: session.id ?? session.account,
    source: body.source ?? "",
    style: body.style ?? "",
    type: body.type ?? "战纪宇宙"
  });

  return NextResponse.json({ ok: true, project });
}
