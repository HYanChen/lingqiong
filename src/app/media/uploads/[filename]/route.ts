import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const filenamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(gif|jpg|png|webp)$/u;

const mimeTypes = {
  gif: "image/gif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
} as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;
  const match = filenamePattern.exec(filename);

  if (!match) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const bytes = await readFile(
      path.join(process.cwd(), "data", "site-media", filename)
    );

    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": mimeTypes[match[1] as keyof typeof mimeTypes],
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
