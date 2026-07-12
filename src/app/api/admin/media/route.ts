import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type SupportedImage = {
  extension: "gif" | "jpg" | "png" | "webp";
  mimeType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
};

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function supportedImage(bytes: Uint8Array): SupportedImage | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { extension: "gif", mimeType: "image/gif" };
  }

  return null;
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin("content.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message, ok: false },
      { status: authorization.status }
    );
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json(
      { message: "请使用图片上传表单。", ok: false },
      { status: 415 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json(
      { message: "请选择需要上传的人物照片。", ok: false },
      { status: 400 }
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { message: "人物照片不能超过 8MB。", ok: false },
      { status: 413 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = supportedImage(bytes);

  if (!image) {
    return NextResponse.json(
      { message: "仅支持 JPG、PNG、WebP 或 GIF 图片。", ok: false },
      { status: 415 }
    );
  }

  const filename = `${randomUUID()}.${image.extension}`;
  const directory = path.join(process.cwd(), "data", "site-media");

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), bytes, { flag: "wx" });
    await recordAdminAuditSafely({
      action: "content.media.upload",
      actor: authorization.user,
      details: {
        bytes: file.size,
        mimeType: image.mimeType
      },
      request,
      targetId: filename,
      targetType: "site_media"
    });

    return NextResponse.json({
      ok: true,
      url: `/media/uploads/${filename}`
    });
  } catch {
    return NextResponse.json(
      { message: "图片保存失败，请稍后重试。", ok: false },
      { status: 500 }
    );
  }
}
