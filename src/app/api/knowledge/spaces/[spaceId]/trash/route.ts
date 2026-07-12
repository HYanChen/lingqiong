import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import { listKnowledgeTrash } from "@/lib/knowledge-trash";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    return NextResponse.json({
      items: await listKnowledgeTrash(spaceId),
      ok: true
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
