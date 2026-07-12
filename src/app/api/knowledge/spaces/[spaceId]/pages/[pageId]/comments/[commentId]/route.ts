import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  deleteKnowledgePageComment,
  knowledgeRoleCan,
  updateKnowledgePageComment
} from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ commentId: string; pageId: string; spaceId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { commentId, pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "comment");
    if ("response" in access) return access.response;
    const comment = await updateKnowledgePageComment(
      spaceId,
      pageId,
      commentId,
      access.actor,
      knowledgeRoleCan(access.accessRole, "write"),
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ comment, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { commentId, pageId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "comment");
    if ("response" in access) return access.response;
    await deleteKnowledgePageComment(
      spaceId,
      pageId,
      commentId,
      access.actor,
      knowledgeRoleCan(access.accessRole, "write"),
      deleteRevision(request)
    );
    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
