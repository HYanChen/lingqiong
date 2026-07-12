import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  createKnowledgeField,
  listKnowledgeFields
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string; tableId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    return NextResponse.json({ fields: await listKnowledgeFields(tableId), ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const field = await createKnowledgeField(tableId, await readKnowledgeJson(request));
    return NextResponse.json({ field, ok: true }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
