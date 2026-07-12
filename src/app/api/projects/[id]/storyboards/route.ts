import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionListQuery,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import { createStoryboard, listStoryboards } from "@/lib/production-pipeline";

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
    const storyboards = await listStoryboards(id, {
      episodeId: query.episodeId
    });
    return NextResponse.json({ ok: true, storyboards });
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

    const storyboard = await createStoryboard(
      id,
      await readProductionJson(request)
    );
    return NextResponse.json({ ok: true, storyboard }, { status: 201 });
  } catch (error) {
    return handleProductionError(error);
  }
}
