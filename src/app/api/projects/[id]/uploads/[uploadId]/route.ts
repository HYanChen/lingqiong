import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { forbiddenResponse, requirePlatformUser } from "@/lib/auth-guards";
import {
  deleteProjectUpload,
  getProject,
  getProjectUpload
} from "@/lib/projects";
import { sessionCanAccessOwner } from "@/lib/platform-auth";

export const runtime = "nodejs";

async function authorizedUpload(
  projectId: string,
  uploadId: string,
  capability: "read" | "write"
) {
  const { response, session } = await requirePlatformUser();

  if (response) {
    return { response };
  }

  const project = await getProject(projectId);

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
    return { response: forbiddenResponse("无权访问该项目文件。") };
  }

  const upload = await getProjectUpload(projectId, uploadId);

  if (!upload) {
    return {
      response: NextResponse.json(
        { message: "文件不存在。", ok: false },
        { status: 404 }
      )
    };
  }

  const projectRoot = path.resolve(
    process.cwd(),
    "data",
    "uploads",
    "projects",
    projectId
  );
  const absolutePath = path.resolve(process.cwd(), upload.storagePath);

  if (!absolutePath.startsWith(`${projectRoot}${path.sep}`)) {
    return {
      response: NextResponse.json(
        { message: "文件存储路径无效。", ok: false },
        { status: 500 }
      )
    };
  }

  return { absolutePath, upload };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; uploadId: string }> }
) {
  const { id, uploadId } = await context.params;
  const result = await authorizedUpload(id, uploadId, "read");

  if (result.response) {
    return result.response;
  }

  try {
    const content = await readFile(result.absolutePath);

    return new NextResponse(content, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.upload.fileName)}`,
        "Content-Length": String(content.byteLength),
        "Content-Type": result.upload.fileType || "application/octet-stream",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json(
      { message: "文件内容不存在。", ok: false },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; uploadId: string }> }
) {
  const { id, uploadId } = await context.params;
  const result = await authorizedUpload(id, uploadId, "write");

  if (result.response) {
    return result.response;
  }

  const deleted = await deleteProjectUpload(id, uploadId);

  if (!deleted) {
    return NextResponse.json(
      { message: "文件不存在。", ok: false },
      { status: 404 }
    );
  }

  await rm(result.absolutePath, { force: true });

  return NextResponse.json({ ok: true });
}
