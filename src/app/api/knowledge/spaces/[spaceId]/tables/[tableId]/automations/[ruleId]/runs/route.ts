import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  listLimit,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  createManualKnowledgeAutomationRun,
  listKnowledgeAutomationRuns
} from "@/lib/knowledge-automations";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ ruleId: string; spaceId: string; tableId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { ruleId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    return NextResponse.json({
      ok: true,
      runs: await listKnowledgeAutomationRuns(
        tableId,
        ruleId,
        listLimit(request, 200)
      )
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { ruleId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const run = await createManualKnowledgeAutomationRun(
      tableId,
      ruleId,
      await readKnowledgeJson(request),
      access.actor
    );
    return NextResponse.json({ ok: true, run }, { status: 202 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
