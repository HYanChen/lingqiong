import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  createKnowledgeView,
  listKnowledgeViews
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string; tableId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    return NextResponse.json({ ok: true, views: await listKnowledgeViews(tableId) });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const view = await createKnowledgeView(tableId, await readKnowledgeJson(request));
    return NextResponse.json({ ok: true, view }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
