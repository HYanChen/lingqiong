import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  createKnowledgeRecordComment,
  listKnowledgeRecordComments
} from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ recordId: string; spaceId: string; tableId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    return NextResponse.json({
      comments: await listKnowledgeRecordComments(tableId, recordId),
      ok: true
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "comment");
    if ("response" in access) return access.response;
    const comment = await createKnowledgeRecordComment(
      tableId,
      recordId,
      access.actor,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ comment, ok: true }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
