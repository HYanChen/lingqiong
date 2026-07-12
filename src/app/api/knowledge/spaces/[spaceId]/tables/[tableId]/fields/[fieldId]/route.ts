import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  knowledgeErrorResponse,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeField,
  getKnowledgeField,
  updateKnowledgeField
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ fieldId: string; spaceId: string; tableId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { fieldId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    const field = await getKnowledgeField(tableId, fieldId);
    if (!field) return knowledgeErrorResponse("FIELD_NOT_FOUND", "字段不存在。", 404);
    return NextResponse.json({ field, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { fieldId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const field = await updateKnowledgeField(tableId, fieldId, await readKnowledgeJson(request));
    return NextResponse.json({ field, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { fieldId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    await deleteKnowledgeField(tableId, fieldId, deleteRevision(request));
    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
