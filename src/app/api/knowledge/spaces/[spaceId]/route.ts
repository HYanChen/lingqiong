import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeSpace,
  updateKnowledgeSpace
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    return NextResponse.json({ ok: true, space: access.space });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const space = await updateKnowledgeSpace(spaceId, await readKnowledgeJson(request));
    return NextResponse.json({ ok: true, space });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    await deleteKnowledgeSpace(spaceId, deleteRevision(request));
    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
