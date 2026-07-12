import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  knowledgeErrorResponse,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  ensureKnowledgePageVersionHistory,
  listKnowledgePageVersions
} from "@/lib/knowledge-collaboration";
import { getKnowledgePage } from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ pageId: string; spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    const page = await getKnowledgePage(spaceId, pageId);
    if (!page) return knowledgeErrorResponse("PAGE_NOT_FOUND", "页面不存在。", 404);
    await ensureKnowledgePageVersionHistory(page, access.actor);
    return NextResponse.json({
      ok: true,
      versions: await listKnowledgePageVersions(spaceId, pageId)
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
