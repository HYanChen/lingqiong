import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionErrorResponse,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import { getComposition, saveComposition } from "@/lib/production-pipeline";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ episodeId: string; id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { episodeId, id } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const composition = await getComposition(id, episodeId);
    return NextResponse.json({
      composition,
      ok: true,
      revision: composition?.revision ?? 0
    });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { episodeId, id } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const result = await saveComposition(
      id,
      episodeId,
      await readProductionJson(request)
    );

    if (result.status === "conflict") {
      return productionErrorResponse(
        "REVISION_CONFLICT",
        "合成工程已在其他窗口更新，请使用最新版本重试。",
        409,
        {
          extra: {
            composition: result.current,
            revision: result.current?.revision ?? 0
          }
        }
      );
    }

    return NextResponse.json({
      composition: result.composition,
      ok: true,
      revision: result.composition.revision
    });
  } catch (error) {
    return handleProductionError(error);
  }
}
