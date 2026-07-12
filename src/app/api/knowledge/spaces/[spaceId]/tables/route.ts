import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  createKnowledgeTable,
  listKnowledgeTables
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    return NextResponse.json({ ok: true, tables: await listKnowledgeTables(spaceId) });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const table = await createKnowledgeTable(spaceId, await readKnowledgeJson(request));
    return NextResponse.json({ ok: true, table }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
