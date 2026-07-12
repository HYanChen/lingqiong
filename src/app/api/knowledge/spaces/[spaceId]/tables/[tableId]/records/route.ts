import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  listLimit,
  listOffset,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  countKnowledgeRecords,
  createKnowledgeRecord,
  listKnowledgeRecords
} from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string; tableId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    const limit = listLimit(request);
    const offset = listOffset(request);
    const [records, total] = await Promise.all([
      listKnowledgeRecords(tableId, limit, offset),
      countKnowledgeRecords(tableId)
    ]);
    return NextResponse.json({
      hasMore: offset + records.length < total,
      limit,
      ok: true,
      offset,
      records,
      total
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const record = await createKnowledgeRecord(
      tableId,
      access.actor,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ ok: true, record }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
