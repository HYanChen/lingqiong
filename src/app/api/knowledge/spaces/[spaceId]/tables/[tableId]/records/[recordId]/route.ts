import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  knowledgeErrorResponse,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeRecord,
  getKnowledgeRecord,
  updateKnowledgeRecord
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ recordId: string; spaceId: string; tableId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    const record = await getKnowledgeRecord(tableId, recordId);
    if (!record) return knowledgeErrorResponse("RECORD_NOT_FOUND", "记录不存在。", 404);
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const record = await updateKnowledgeRecord(
      tableId,
      recordId,
      access.actor,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    await deleteKnowledgeRecord(
      tableId,
      recordId,
      deleteRevision(request),
      access.actor
    );
    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
