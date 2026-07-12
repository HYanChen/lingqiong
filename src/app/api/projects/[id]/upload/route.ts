import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { forbiddenResponse, requirePlatformUser } from "@/lib/auth-guards";
import {
  createProjectUpload,
  getProject,
  listProjectUploads
} from "@/lib/projects";
import { sessionCanAccessOwner } from "@/lib/platform-auth";

export const runtime = "nodejs";

const MAX_FILE_COUNT = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_REQUEST_SIZE = 105 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".csv",
  ".docx",
  ".gif",
  ".jpeg",
  ".jpg",
  ".json",
  ".m4a",
  ".md",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".txt",
  ".wav",
  ".webm",
  ".webp",
  ".xlsx"
]);
const ALLOWED_MIME_PREFIXES = ["audio/", "image/", "text/", "video/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

function safeUploadName(value: string) {
  const extension = path.extname(value).slice(0, 24);
  const base =
    path
      .basename(value, extension)
      .trim()
      .replace(/[^\u4e00-\u9fa5\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "project_asset";

  return `${base}${extension}`;
}

function allowedUpload(file: File) {
  const extension = path.extname(file.name).toLowerCase();
  const mimeAllowed =
    !file.type ||
    ALLOWED_MIME_TYPES.has(file.type) ||
    ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));

  return ALLOWED_EXTENSIONS.has(extension) && mimeAllowed;
}

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

  if (!sessionCanAccessOwner(session, project.ownerId, project.ownerAccount, "read")) {
    return forbiddenResponse("无权查看该项目文件。");
  }

  return NextResponse.json({
    ok: true,
    uploads: await listProjectUploads(id)
  });
}

export async function POST(
  request: Request,
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

  if (!sessionCanAccessOwner(session, project.ownerId, project.ownerAccount, "write")) {
    return forbiddenResponse("无权上传该项目文件。");
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > MAX_REQUEST_SIZE) {
    return NextResponse.json(
      { message: "单次上传总大小不能超过 100MB。", ok: false },
      { status: 413 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const files = formData
    ?.getAll("files")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!files?.length) {
    return NextResponse.json({ message: "请选择要上传的文件。", ok: false }, { status: 400 });
  }

  if (files.length > MAX_FILE_COUNT) {
    return NextResponse.json(
      { message: `单次最多上传 ${MAX_FILE_COUNT} 个文件。`, ok: false },
      { status: 400 }
    );
  }

  const invalidFile = files.find(
    (file) => file.size > MAX_FILE_SIZE || !allowedUpload(file)
  );

  if (invalidFile) {
    return NextResponse.json(
      {
        message:
          invalidFile.size > MAX_FILE_SIZE
            ? `文件“${invalidFile.name}”超过 50MB。`
            : `文件“${invalidFile.name}”的格式不受支持。`,
        ok: false
      },
      { status: 400 }
    );
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0);

  if (totalSize > 100 * 1024 * 1024) {
    return NextResponse.json(
      { message: "单次上传总大小不能超过 100MB。", ok: false },
      { status: 413 }
    );
  }

  const uploadRoot = path.join(process.cwd(), "data", "uploads", "projects", id);
  await mkdir(uploadRoot, { recursive: true });

  const uploads = [];

  for (const file of files) {
    const storedName = `${randomUUID()}-${safeUploadName(file.name)}`;
    const absolutePath = path.join(uploadRoot, storedName);
    const storagePath = path.relative(process.cwd(), absolutePath).replaceAll(path.sep, "/");

    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    try {
      uploads.push(
        await createProjectUpload({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || undefined,
          ownerAccount: session.account,
          ownerId: session.id ?? session.account,
          projectId: project.id,
          storagePath
        })
      );
    } catch (error) {
      await rm(absolutePath, { force: true });
      throw error;
    }
  }

  return NextResponse.json({ ok: true, uploads });
}
