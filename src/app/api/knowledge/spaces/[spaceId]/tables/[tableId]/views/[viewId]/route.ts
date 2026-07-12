import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  knowledgeErrorResponse,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeView,
  getKnowledgeView,
  updateKnowledgeView
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string; tableId: string; viewId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId, tableId, viewId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    const view = await getKnowledgeView(tableId, viewId);
    if (!view) return knowledgeErrorResponse("VIEW_NOT_FOUND", "视图不存在。", 404);
    return NextResponse.json({ ok: true, view });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { spaceId, tableId, viewId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const view = await updateKnowledgeView(tableId, viewId, await readKnowledgeJson(request));
    return NextResponse.json({ ok: true, view });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { spaceId, tableId, viewId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    await deleteKnowledgeView(tableId, viewId, deleteRevision(request));
    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
