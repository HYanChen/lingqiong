import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  knowledgeErrorResponse,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import { importKnowledgeCsv } from "@/lib/knowledge-import";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ spaceId: string; tableId: string }>;
};

const maxImportBytes = 20 * 1024 * 1024;

export async function POST(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxImportBytes + 128 * 1024) {
      return knowledgeErrorResponse("IMPORT_TOO_LARGE", "CSV 文件不能超过 20MB。", 413);
    }

    const form = await request.formData();
    const upload = form.get("file");
    if (!(upload instanceof File)) {
      return knowledgeErrorResponse("FILE_REQUIRED", "请选择 CSV 文件。", 400);
    }
    const extensionValid = upload.name.toLowerCase().endsWith(".csv");
    const mimeValid = ["application/csv", "text/csv", "text/plain"].includes(upload.type);
    if (!extensionValid && !mimeValid) {
      return knowledgeErrorResponse("INVALID_FILE_TYPE", "仅支持导入 CSV 文件。", 415);
    }

    const result = await importKnowledgeCsv({
      actor: access.actor,
      bytes: new Uint8Array(await upload.arrayBuffer()),
      createMissingFields: form.get("createMissingFields") !== "false",
      tableId
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

