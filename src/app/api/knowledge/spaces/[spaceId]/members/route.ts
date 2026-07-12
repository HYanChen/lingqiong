import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  createKnowledgeSpaceMember,
  listKnowledgeSpaceMembers
} from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    return NextResponse.json({
      members: await listKnowledgeSpaceMembers(spaceId),
      ok: true
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "manage");
    if ("response" in access) return access.response;
    const member = await createKnowledgeSpaceMember(
      spaceId,
      access.actor,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ member, ok: true }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
