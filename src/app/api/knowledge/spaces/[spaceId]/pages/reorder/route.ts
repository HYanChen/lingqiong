import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import { reorderKnowledgePages } from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const pages = await reorderKnowledgePages(spaceId, await readKnowledgeJson(request));
    return NextResponse.json({ ok: true, pages });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
