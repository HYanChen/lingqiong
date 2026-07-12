import { NextResponse } from "next/server";

import { forbiddenResponse, requirePlatformUser } from "@/lib/auth-guards";
import {
  getProjectCanvas,
  saveProjectCanvas
} from "@/lib/project-canvas";
import { getProject } from "@/lib/projects";
import { sessionCanAccessOwner } from "@/lib/platform-auth";

const MAX_CANVAS_BYTES = 2 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function authorizedProject(id: string, capability: "read" | "write") {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return { response };
  }

  const project = await getProject(id);

  if (!project) {
    return {
      response: NextResponse.json(
        { message: "项目不存在。", ok: false },
        { status: 404 }
      )
    };
  }

  if (
    !sessionCanAccessOwner(
      session,
      project.ownerId,
      project.ownerAccount,
      capability
    )
  ) {
    return { response: forbiddenResponse("无权访问该项目画布。") };
  }

  return { project, session };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await authorizedProject(id, "read");

  if (access.response) {
    return access.response;
  }

  const canvas = await getProjectCanvas(id);

  return NextResponse.json({
    canvas: canvas?.state ?? null,
    ok: true,
    revision: canvas?.revision ?? 0,
    updatedAt: canvas?.updatedAt ?? null
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const access = await authorizedProject(id, "write");

  if (access.response) {
    return access.response;
  }

  const body = (await request.json().catch(() => null)) as null | {
    revision?: number;
    state?: unknown;
  };

  if (
    !body ||
    !Number.isInteger(body.revision) ||
    Number(body.revision) < 0 ||
    !isRecord(body.state) ||
    !Array.isArray(body.state.nodes) ||
    !Array.isArray(body.state.edges) ||
    body.state.nodes.length > 200 ||
    body.state.edges.length > 500
  ) {
    return NextResponse.json(
      { message: "画布数据格式不正确。", ok: false },
      { status: 400 }
    );
  }

  const serialized = JSON.stringify(body.state);

  if (Buffer.byteLength(serialized, "utf8") > MAX_CANVAS_BYTES) {
    return NextResponse.json(
      { message: "画布数据不能超过 2MB。", ok: false },
      { status: 413 }
    );
  }

  const result = await saveProjectCanvas({
    expectedRevision: Number(body.revision),
    ownerAccount: access.session.account,
    ownerId: access.session.id ?? access.session.account,
    projectId: id,
    state: body.state
  });

  if (result.status === "conflict") {
    return NextResponse.json(
      {
        canvas: result.current?.state ?? null,
        message: "画布已在其他窗口更新，请刷新后再保存。",
        ok: false,
        revision: result.current?.revision ?? 0
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    canvas: result.record.state,
    ok: true,
    revision: result.record.revision,
    updatedAt: result.record.updatedAt
  });
}
