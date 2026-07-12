import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  knowledgeErrorResponse,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeAttachment,
  getKnowledgeAttachmentDownload,
  knowledgeAttachmentContentDisposition
} from "@/lib/knowledge-attachments";
import { getKnowledgeRecord } from "@/lib/knowledge-workspace";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    attachmentId: string;
    recordId: string;
    spaceId: string;
    tableId: string;
  }>;
};

async function validateResourceIds(
  tableId: string,
  recordId: string,
  attachmentId: string
) {
  if (!recordId || recordId.length > 191) {
    return knowledgeErrorResponse(
      "INVALID_RECORD_ID",
      "记录 ID 格式不正确。",
      400
    );
  }

  if (!attachmentId || attachmentId.length > 191) {
    return knowledgeErrorResponse(
      "INVALID_ATTACHMENT_ID",
      "附件 ID 格式不正确。",
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
    const { attachmentId, recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;

    const invalidResource = await validateResourceIds(
      tableId,
      recordId,
      attachmentId
    );
    if (invalidResource) return invalidResource;

    const result = await getKnowledgeAttachmentDownload(
      spaceId,
      tableId,
      recordId,
      attachmentId
    );

    if (!result) {
      return knowledgeErrorResponse(
        "ATTACHMENT_NOT_FOUND",
        "附件不存在。",
        404
      );
    }

    return new NextResponse(result.content, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": knowledgeAttachmentContentDisposition(
          result.attachment.fileName
        ),
        "Content-Length": String(result.content.byteLength),
        "Content-Type": result.attachment.mimeType,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { attachmentId, recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;

    const invalidResource = await validateResourceIds(
      tableId,
      recordId,
      attachmentId
    );
    if (invalidResource) return invalidResource;

    const attachment = await deleteKnowledgeAttachment(
      spaceId,
      tableId,
      recordId,
      attachmentId,
      deleteRevision(request)
    );

    if (!attachment) {
      return knowledgeErrorResponse(
        "ATTACHMENT_NOT_FOUND",
        "附件不存在。",
        404
      );
    }

    return NextResponse.json({ attachment, deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
