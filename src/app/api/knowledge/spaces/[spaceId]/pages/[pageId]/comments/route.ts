import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  createKnowledgePageComment,
  listKnowledgePageComments
} from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = { params: Promise<{ pageId: string; spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    return NextResponse.json({
      comments: await listKnowledgePageComments(spaceId, pageId),
      ok: true
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "comment");
    if ("response" in access) return access.response;
    const comment = await createKnowledgePageComment(
      spaceId,
      pageId,
      access.actor,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ comment, ok: true }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
