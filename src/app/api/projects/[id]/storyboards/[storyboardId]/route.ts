import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionErrorResponse,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import {
  deleteStoryboard,
  getStoryboard,
  updateStoryboard
} from "@/lib/production-pipeline";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; storyboardId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, storyboardId } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const storyboard = await getStoryboard(id, storyboardId);

    if (!storyboard) {
      return productionErrorResponse(
        "STORYBOARD_NOT_FOUND",
        "分镜不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ ok: true, storyboard });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, storyboardId } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const storyboard = await updateStoryboard(
      id,
      storyboardId,
      await readProductionJson(request)
    );

    if (!storyboard) {
      return productionErrorResponse(
        "STORYBOARD_NOT_FOUND",
        "分镜不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ ok: true, storyboard });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, storyboardId } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const deleted = await deleteStoryboard(id, storyboardId);

    if (!deleted) {
      return productionErrorResponse(
        "STORYBOARD_NOT_FOUND",
        "分镜不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}
