import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  knowledgeErrorResponse,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import { getKnowledgePageVersion } from "@/lib/knowledge-collaboration";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ pageId: string; spaceId: string; versionId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { pageId, spaceId, versionId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId);
    if ("response" in access) return access.response;
    const version = await getKnowledgePageVersion(spaceId, pageId, versionId);
    if (!version) {
      return knowledgeErrorResponse("VERSION_NOT_FOUND", "页面版本不存在。", 404);
    }
    return NextResponse.json({ ok: true, version });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
