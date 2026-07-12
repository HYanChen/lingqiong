import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  restoreKnowledgeTrashItem,
  type KnowledgeTrashResourceType
} from "@/lib/knowledge-trash";
import { KnowledgeValidationError, requiredRevision } from "@/lib/knowledge-validation";

export const runtime = "nodejs";
type Context = {
  params: Promise<{ resourceId: string; resourceType: string; spaceId: string }>;
};

function resourceType(value: string): KnowledgeTrashResourceType {
  if (value !== "page" && value !== "table") {
    throw new KnowledgeValidationError(
      "INVALID_RESOURCE_TYPE",
      "回收站资源类型只能是 page 或 table。"
    );
  }
  return value;
}

export async function POST(request: Request, context: Context) {
  try {
    const { resourceId, resourceType: rawType, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "write");
    if ("response" in access) return access.response;
    const body = await readKnowledgeJson(request);
    const item = await restoreKnowledgeTrashItem(
      spaceId,
      resourceType(rawType),
      resourceId,
      requiredRevision(body.revision)
    );
    return NextResponse.json({ item, ok: true, restored: true });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
