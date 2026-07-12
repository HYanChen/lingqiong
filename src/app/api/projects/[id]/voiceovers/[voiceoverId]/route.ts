import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionErrorResponse,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import {
  deleteVoiceover,
  getVoiceover,
  updateVoiceover
} from "@/lib/production-pipeline";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; voiceoverId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, voiceoverId } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const voiceover = await getVoiceover(id, voiceoverId);

    if (!voiceover) {
      return productionErrorResponse(
        "VOICEOVER_NOT_FOUND",
        "配音不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ ok: true, voiceover });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, voiceoverId } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const voiceover = await updateVoiceover(
      id,
      voiceoverId,
      await readProductionJson(request)
    );

    if (!voiceover) {
      return productionErrorResponse(
        "VOICEOVER_NOT_FOUND",
        "配音不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ ok: true, voiceover });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, voiceoverId } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const deleted = await deleteVoiceover(id, voiceoverId);

    if (!deleted) {
      return productionErrorResponse(
        "VOICEOVER_NOT_FOUND",
        "配音不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}
