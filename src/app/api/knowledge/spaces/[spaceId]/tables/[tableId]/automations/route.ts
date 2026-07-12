import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  createKnowledgeAutomationRule,
  listKnowledgeAutomationRules
} from "@/lib/knowledge-automations";

export const runtime = "nodejs";
type Context = { params: Promise<{ spaceId: string; tableId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    return NextResponse.json({
      automations: await listKnowledgeAutomationRules(tableId),
      ok: true
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
    const automation = await createKnowledgeAutomationRule(
      tableId,
      access.actor,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ automation, ok: true }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
