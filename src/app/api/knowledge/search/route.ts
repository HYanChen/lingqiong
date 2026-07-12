import { NextResponse } from "next/server";

import {
  handleKnowledgeError,
  requireKnowledgeSpace,
  requireKnowledgeUser
} from "@/lib/knowledge-api";
import {
  listAccessibleKnowledgeSpaces
} from "@/lib/knowledge-collaboration";
import { searchKnowledge } from "@/lib/knowledge-search";
import { listKnowledgeSpaces } from "@/lib/knowledge-workspace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireKnowledgeUser("read");
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const requestedSpaceId = url.searchParams.get("spaceId")?.trim();
    let spaceIds: string[];
    if (requestedSpaceId) {
      const access = await requireKnowledgeSpace(requestedSpaceId, "read");
      if ("response" in access) return access.response;
      spaceIds = [requestedSpaceId];
    } else if (auth.session.source === "admin") {
      spaceIds = (await listKnowledgeSpaces()).map((space) => space.id);
    } else {
      spaceIds = (await listAccessibleKnowledgeSpaces(auth.actor.id)).map(
        (space) => space.id
      );
    }

    const results = await searchKnowledge({
      limit: Number(url.searchParams.get("limit") || 50),
      query: url.searchParams.get("q") || "",
      spaceIds
    });
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

