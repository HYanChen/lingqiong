import { NextResponse } from "next/server";

import {
  deleteRevision,
  handleKnowledgeError,
  requireKnowledgeSpace
} from "@/lib/knowledge-api";
import {
  permanentlyDeleteKnowledgeTrashItem,
  type KnowledgeTrashResourceType
} from "@/lib/knowledge-trash";
import { KnowledgeValidationError } from "@/lib/knowledge-validation";

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

export async function DELETE(request: Request, context: Context) {
  try {
    const { resourceId, resourceType: rawType, spaceId } = await context.params;
    const access = await requireKnowledgeSpace(spaceId, "manage");
    if ("response" in access) return access.response;
    const result = await permanentlyDeleteKnowledgeTrashItem(
      spaceId,
      resourceType(rawType),
      resourceId,
      deleteRevision(request)
    );
    return NextResponse.json({ deleted: true, ok: true, result });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
