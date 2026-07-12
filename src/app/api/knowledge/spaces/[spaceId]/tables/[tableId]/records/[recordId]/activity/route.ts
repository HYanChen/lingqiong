import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  listLimit,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import { listKnowledgeRecordActivities } from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ recordId: string; spaceId: string; tableId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { recordId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    return NextResponse.json({
      activities: await listKnowledgeRecordActivities(
        tableId,
        recordId,
        listLimit(request, 200)
      ),
      ok: true
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
