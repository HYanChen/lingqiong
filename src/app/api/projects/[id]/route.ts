import { rm } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  deleteProject,
  getProject,
  listProjectUploads,
  updateProject
} from "@/lib/projects";
import { forbiddenResponse, requirePlatformUser } from "@/lib/auth-guards";
import { sessionCanAccessOwner } from "@/lib/platform-auth";
import {
  ProjectInputError,
  readProjectMutationInput
} from "@/lib/project-input";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ message: "项目不存在。", ok: false }, { status: 404 });
  }

  if (!sessionCanAccessOwner(session, project.ownerId, project.ownerAccount)) {
    return forbiddenResponse("无权访问该项目。");
  }

  return NextResponse.json({ ok: true, project });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const { id } = await context.params;
  let body;

  try {
    body = await readProjectMutationInput(request, { creating: false });
  } catch (error) {
    if (error instanceof ProjectInputError) {
      return NextResponse.json(
        { message: error.message, ok: false },
        { status: error.status }
      );
    }

    throw error;
  }

  const currentProject = await getProject(id);

  if (!currentProject) {
    return NextResponse.json({ message: "项目不存在。", ok: false }, { status: 404 });
  }

  if (
    !sessionCanAccessOwner(
      session,
      currentProject.ownerId,
      currentProject.ownerAccount,
      "write"
    )
  ) {
    return forbiddenResponse("无权编辑该项目。");
  }

  const project = await updateProject(id, {
    aspectRatio: body.aspectRatio,
    coverImage: body.coverImage,
    deliverables: body.deliverables,
    goal: body.goal,
    name: body.name,
    ownerAccount:
      session.source === "admin"
        ? body.ownerAccount ?? currentProject.ownerAccount
        : session.account,
    ownerId:
      session.source === "admin"
        ? body.ownerId ?? currentProject.ownerId
        : session.id ?? session.account,
    source: body.source,
    style: body.style,
    type: body.type
  });

  if (!project) {
    return NextResponse.json({ message: "项目不存在。", ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true, project });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ message: "项目不存在。", ok: false }, { status: 404 });
  }

  if (
    !sessionCanAccessOwner(
      session,
      project.ownerId,
      project.ownerAccount,
      "write"
    )
  ) {
    return forbiddenResponse("无权删除该项目。");
  }

  const uploads = await listProjectUploads(id);
  const deleted = await deleteProject(id);

  if (!deleted) {
    return NextResponse.json({ message: "项目不存在。", ok: false }, { status: 404 });
  }

  await rm(path.join(process.cwd(), "data", "uploads", "projects", id), {
    force: true,
    recursive: true
  });

  return NextResponse.json({ ok: true, removedUploads: uploads.length });
}
