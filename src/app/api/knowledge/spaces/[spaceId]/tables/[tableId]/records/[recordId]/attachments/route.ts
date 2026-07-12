import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  knowledgeErrorResponse,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  createKnowledgeAttachment,
  listKnowledgeAttachments,
  MAX_KNOWLEDGE_ATTACHMENT_REQUEST_SIZE,
  MAX_KNOWLEDGE_ATTACHMENT_SIZE,
  type KnowledgeAttachment
} from "@/lib/knowledge-attachments";
import { getKnowledgeRecord } from "@/lib/knowledge-workspace";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ recordId: string; spaceId: string; tableId: string }>;
};

function downloadUrl(
  spaceId: string,
  tableId: string,
  recordId: string,
  attachmentId: string
) {
  return `/_wcu-api/knowledge/spaces/${encodeURIComponent(spaceId)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

function withDownloadUrl(
  attachment: KnowledgeAttachment,
  spaceId: string,
  tableId: string,
  recordId: string
) {
  return {
    ...attachment,
    downloadUrl: downloadUrl(spaceId, tableId, recordId, attachment.id)
  };
}

async function validateRecord(tableId: string, recordId: string) {
  if (!recordId || recordId.length > 191) {
    return knowledgeErrorResponse(
      "INVALID_RECORD_ID",
      "记录 ID 格式不正确。",
      400
    );
  }

  const record = await getKnowledgeRecord(tableId, recordId);

  return record
    ? null
    : knowledgeErrorResponse("RECORD_NOT_FOUND", "记录不存在。", 404);
}

export async function GET(_request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;

    const invalidRecord = await validateRecord(tableId, recordId);
    if (invalidRecord) return invalidRecord;

    const attachments = await listKnowledgeAttachments(
      spaceId,
      tableId,
      recordId
    );

    return NextResponse.json({
      attachments: attachments.map((attachment) =>
        withDownloadUrl(attachment, spaceId, tableId, recordId)
      ),
      ok: true
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;

    const invalidRecord = await validateRecord(tableId, recordId);
    if (invalidRecord) return invalidRecord;

    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("multipart/form-data")
    ) {
      return knowledgeErrorResponse(
        "MULTIPART_REQUIRED",
        "请使用 multipart/form-data 上传附件。",
        415
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_KNOWLEDGE_ATTACHMENT_REQUEST_SIZE
    ) {
      return knowledgeErrorResponse(
        "ATTACHMENT_TOO_LARGE",
        "单个附件不能超过 20MB。",
        413
      );
    }

    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return knowledgeErrorResponse(
        "INVALID_MULTIPART",
        "附件上传内容无法解析。",
        400
      );
    }

    const candidates = [
      ...formData.getAll("file"),
      ...formData.getAll("files")
    ];
    const files = candidates.filter(
      (item): item is File => item instanceof File
    );

    if (candidates.length !== 1 || files.length !== 1) {
      return knowledgeErrorResponse(
        "SINGLE_ATTACHMENT_REQUIRED",
        "每次只能上传一个附件，请使用 file 字段。",
        400
      );
    }

    const [file] = files;

    if (!file.size) {
      return knowledgeErrorResponse("EMPTY_ATTACHMENT", "不能上传空文件。", 400);
    }

    if (file.size > MAX_KNOWLEDGE_ATTACHMENT_SIZE) {
      return knowledgeErrorResponse(
        "ATTACHMENT_TOO_LARGE",
        "单个附件不能超过 20MB。",
        413
      );
    }

    const attachment = await createKnowledgeAttachment({
      actor: access.actor,
      content: new Uint8Array(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type,
      recordId,
      spaceId,
      tableId
    });

    return NextResponse.json(
      {
        attachment: withDownloadUrl(attachment, spaceId, tableId, recordId),
        ok: true
      },
      { status: 201 }
    );
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
