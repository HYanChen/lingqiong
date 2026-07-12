import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import { updateKnowledgeAutomationRun } from "@/lib/knowledge-automations";

export const runtime = "nodejs";
type Context = {
  params: Promise<{
    ruleId: string;
    runId: string;
    spaceId: string;
    tableId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { ruleId, runId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const run = await updateKnowledgeAutomationRun(
      tableId,
      ruleId,
      runId,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ ok: true, run });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
