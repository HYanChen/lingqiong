import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeRecordComment,
  knowledgeRoleCan,
  updateKnowledgeRecordComment
} from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = {
  params: Promise<{
    commentId: string;
    recordId: string;
    spaceId: string;
    tableId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { commentId, recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "comment");
    if ("response" in access) return access.response;
    const comment = await updateKnowledgeRecordComment(
      tableId,
      recordId,
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
    const { commentId, recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "comment");
    if ("response" in access) return access.response;
    await deleteKnowledgeRecordComment(
      tableId,
      recordId,
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
