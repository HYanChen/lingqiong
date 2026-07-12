import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  knowledgeErrorResponse,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import { getKnowledgePageVersion } from "@/lib/knowledge-collaboration";
import { updateKnowledgePage } from "@/lib/knowledge-workspace";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ pageId: string; spaceId: string; versionId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const { pageId, spaceId, versionId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const version = await getKnowledgePageVersion(spaceId, pageId, versionId);
    if (!version) {
      return knowledgeErrorResponse("VERSION_NOT_FOUND", "页面版本不存在。", 404);
    }
    const body = await readKnowledgeJson(request);
    const page = await updateKnowledgePage(
      spaceId,
      pageId,
      {
        changeSummary: `恢复到版本 ${version.versionNumber}`,
        content: version.content,
        revision: body.revision,
        title: version.title
      },
      access.actor
    );
    return NextResponse.json({ ok: true, page, restoredFrom: version });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
