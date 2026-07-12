import { NextResponse } from "next/server";

import {
  handleProductionError,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import { createEpisode, listEpisodes } from "@/lib/production-pipeline";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    return NextResponse.json({
      episodes: await listEpisodes(id),
      ok: true
    });
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

    const episode = await createEpisode(id, await readProductionJson(request));
    return NextResponse.json({ episode, ok: true }, { status: 201 });
  } catch (error) {
    return handleProductionError(error);
  }
}
