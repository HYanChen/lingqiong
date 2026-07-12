import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  createKnowledgePage,
  listKnowledgePages
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    return NextResponse.json({ ok: true, pages: await listKnowledgePages(spaceId) });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const page = await createKnowledgePage(
      spaceId,
      await readKnowledgeJson(request),
      access.actor
    );
    return NextResponse.json({ ok: true, page }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
