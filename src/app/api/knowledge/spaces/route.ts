import { NextResponse } from "next/server";

import {
  listAccessibleKnowledgeSpaces
} from "@/lib/knowledge-collaboration";
import {
  handleKnowledgeError,
  readKnowledgeJson,
  requireKnowledgeUser
} from "@/lib/knowledge-api";
import {
  createKnowledgeSpace,
  ensureDefaultKnowledgeWorkspace,
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
    return NextResponse.json({
      ok: true,
      spaces: canReadAll
        ? await listKnowledgeSpaces()
        : await listAccessibleKnowledgeSpaces(auth.actor.id)
    });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireKnowledgeUser("write");
    if ("response" in auth) return auth.response;
    const space = await createKnowledgeSpace(auth.actor, await readKnowledgeJson(request));
    return NextResponse.json({ ok: true, space }, { status: 201 });
  } catch (error) {
    return handleKnowledgeError(error);
  }
}
