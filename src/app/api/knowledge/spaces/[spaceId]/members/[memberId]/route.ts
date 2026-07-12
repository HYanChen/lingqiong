import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeSpaceMember,
  updateKnowledgeSpaceMember
} from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = { params: Promise<{ memberId: string; spaceId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const { memberId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "manage");
    if ("response" in access) return access.response;
    const member = await updateKnowledgeSpaceMember(
      spaceId,
      memberId,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ member, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { memberId, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "manage");
    if ("response" in access) return access.response;
    await deleteKnowledgeSpaceMember(spaceId, memberId, deleteRevision(request));
    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
