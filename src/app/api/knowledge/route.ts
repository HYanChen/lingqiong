import { NextResponse } from "next/server";

import { listAccessibleKnowledgeSpaces } from "@/lib/knowledge-collaboration";
import {
  handleKnowledgeError,
  optionalIdQuery,
  requireKnowledgeSpace,
  requireKnowledgeTable,
  requireKnowledgeUser
} from "@/lib/knowledge-api";
import {
  countKnowledgeRecords,
  ensureDefaultKnowledgeWorkspace,
  getKnowledgeDashboard,
  listKnowledgeFields,
  listKnowledgePages,
  listKnowledgeRecords,
  listKnowledgeSpaces,
  listKnowledgeTables,
  listKnowledgeViews
} from "@/lib/knowledge-workspace";
import { sessionHasAdminPermission } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireKnowledgeUser();

    if ("response" in auth) {
      return auth.response;
    }

    const canWrite =
      auth.session.source !== "admin" ||
      sessionHasAdminPermission(auth.session, "projects.write");
    if (canWrite) {
      await ensureDefaultKnowledgeWorkspace(auth.actor);
    }
    const canReadAll =
      auth.session.source === "admin" &&
      sessionHasAdminPermission(auth.session, "projects.read");
    const spaces = canReadAll
      ? await listKnowledgeSpaces()
      : await listAccessibleKnowledgeSpaces(auth.actor.id);
    const dashboard = await getKnowledgeDashboard(
      undefined,
      canReadAll ? undefined : spaces.map((space) => space.id)
    );
    const response: Record<string, unknown> = {
      dashboard,
      ok: true,
      spaces
    };
    const spaceId = optionalIdQuery(request, "spaceId");
    const tableId = optionalIdQuery(request, "tableId");

    if (!spaceId && tableId) {
      return NextResponse.json(
        {
          error: { code: "SPACE_ID_REQUIRED", message: "使用 tableId 时必须同时提供 spaceId。" },
          message: "使用 tableId 时必须同时提供 spaceId。",
          ok: false
        },
        { status: 400 }
      );
    }

    if (spaceId) {
      const access = await requireKnowledgeSpace(spaceId);
      if ("response" in access) return access.response;
      response.accessRole = access.accessRole;
      response.space = access.space;
      [response.pages, response.tables] = await Promise.all([
        listKnowledgePages(spaceId),
        listKnowledgeTables(spaceId)
      ]);
    }

    if (spaceId && tableId) {
      const access = await requireKnowledgeTable(spaceId, tableId);
      if ("response" in access) return access.response;
      response.table = access.table;
      [response.fields, response.records, response.views, response.recordTotal] = await Promise.all([
        listKnowledgeFields(tableId),
        listKnowledgeRecords(tableId),
        listKnowledgeViews(tableId),
        countKnowledgeRecords(tableId)
      ]);
      response.recordHasMore = Number(response.recordTotal) > (response.records as unknown[]).length;
    }

    return NextResponse.json(response);
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
