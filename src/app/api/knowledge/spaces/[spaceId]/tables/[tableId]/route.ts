import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeTable,
  updateKnowledgeTable
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string; tableId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    return NextResponse.json({ ok: true, table: access.table });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const table = await updateKnowledgeTable(spaceId, tableId, await readKnowledgeJson(request));
    return NextResponse.json({ ok: true, table });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const trashItem = await deleteKnowledgeTable(
      spaceId,
      tableId,
      deleteRevision(request),
      access.actor
    );
    return NextResponse.json({ deleted: true, movedToTrash: true, ok: true, trashItem });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
