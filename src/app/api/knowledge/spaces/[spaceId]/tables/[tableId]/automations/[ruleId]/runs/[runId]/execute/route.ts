import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import { executeKnowledgeAutomationRun } from "@/lib/knowledge-automations";

export const runtime = "nodejs";
type Context = {
  params: Promise<{
    ruleId: string;
    runId: string;
    spaceId: string;
    tableId: string;
  }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const { ruleId, runId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const run = await executeKnowledgeAutomationRun(
      tableId,
      ruleId,
      runId,
      access.actor
    );
    return NextResponse.json({ ok: true, run });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
