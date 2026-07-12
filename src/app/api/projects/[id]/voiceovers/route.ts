import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionListQuery,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import { createVoiceover, listVoiceovers } from "@/lib/production-pipeline";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const query = productionListQuery(request);
    const voiceovers = await listVoiceovers(id, {
      episodeId: query.episodeId
    });
    return NextResponse.json({ ok: true, voiceovers });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const voiceover = await createVoiceover(
      id,
      await readProductionJson(request)
    );
    return NextResponse.json({ ok: true, voiceover }, { status: 201 });
  } catch (error) {
    return handleProductionError(error);
  }
}
