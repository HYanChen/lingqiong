import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  knowledgeErrorResponse,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  deleteKnowledgePage,
  getKnowledgePage,
  updateKnowledgePage
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ pageId: string; spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    const page = await getKnowledgePage(spaceId, pageId);
    if (!page) return knowledgeErrorResponse("PAGE_NOT_FOUND", "页面不存在。", 404);
    return NextResponse.json({ ok: true, page });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const page = await updateKnowledgePage(
      spaceId,
      pageId,
      await readKnowledgeJson(request),
      access.actor
    );
    return NextResponse.json({ ok: true, page });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const trashItem = await deleteKnowledgePage(
      spaceId,
      pageId,
      deleteRevision(request),
      access.actor
    );
    return NextResponse.json({ deleted: true, movedToTrash: true, ok: true, trashItem });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
