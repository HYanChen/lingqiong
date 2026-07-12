import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  knowledgeErrorResponse,
  readKnowledgeJson,
  requireKnowledgeTable
} from "@/lib/knowledge-api";
import {
  deleteKnowledgeAutomationRule,
  getKnowledgeAutomationRule,
  updateKnowledgeAutomationRule
} from "@/lib/knowledge-automations";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ ruleId: string; spaceId: string; tableId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { ruleId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId);
    if ("response" in access) return access.response;
    const automation = await getKnowledgeAutomationRule(tableId, ruleId);
    if (!automation) {
      return knowledgeErrorResponse("AUTOMATION_NOT_FOUND", "自动化规则不存在。", 404);
    }
    return NextResponse.json({ automation, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { ruleId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    const automation = await updateKnowledgeAutomationRule(
      tableId,
      ruleId,
      await readKnowledgeJson(request)
    );
    return NextResponse.json({ automation, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { ruleId, spaceId, tableId } = await context.params;
    const access = await requireKnowledgeTable(spaceId, tableId, "write");
    if ("response" in access) return access.response;
    await deleteKnowledgeAutomationRule(tableId, ruleId, deleteRevision(request));
    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
