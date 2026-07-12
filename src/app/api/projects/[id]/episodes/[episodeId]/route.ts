import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionErrorResponse,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import {
  deleteEpisode,
  getEpisode,
  updateEpisode
} from "@/lib/production-pipeline";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ episodeId: string; id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { episodeId, id } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const episode = await getEpisode(id, episodeId);

    if (!episode) {
      return productionErrorResponse(
        "EPISODE_NOT_FOUND",
        "剧集不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ episode, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { episodeId, id } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const episode = await updateEpisode(
      id,
      episodeId,
      await readProductionJson(request)
    );

    if (!episode) {
      return productionErrorResponse(
        "EPISODE_NOT_FOUND",
        "剧集不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ episode, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { episodeId, id } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const deleted = await deleteEpisode(id, episodeId);

    if (!deleted) {
      return productionErrorResponse(
        "EPISODE_NOT_FOUND",
        "剧集不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}
