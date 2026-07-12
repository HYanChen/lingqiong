import { NextResponse } from "next/server";

import { handleKnowledgeError, requireKnowledgeUser } from "@/lib/knowledge-api";
import { listAccessibleKnowledgeSpaces } from "@/lib/knowledge-collaboration";
import {
  ensureDefaultKnowledgeWorkspace,
  getKnowledgeDashboard,
  listKnowledgeSpaces
} from "@/lib/knowledge-workspace";
import { sessionHasAdminPermission } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireKnowledgeUser();
    if ("response" in auth) return auth.response;
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
    return NextResponse.json({
      dashboard: await getKnowledgeDashboard(
        undefined,
        canReadAll ? undefined : spaces.map((space) => space.id)
      ),
      ok: true
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
