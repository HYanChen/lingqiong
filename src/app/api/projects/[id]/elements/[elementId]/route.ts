import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionErrorResponse,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import {
  deleteElement,
  getElement,
  updateElement
} from "@/lib/production-pipeline";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ elementId: string; id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { elementId, id } = await context.params;
    const access = await requireProductionProject(id);

    if ("response" in access) {
      return access.response;
    }

    const element = await getElement(id, elementId);

    if (!element) {
      return productionErrorResponse(
        "ELEMENT_NOT_FOUND",
        "元素不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ element, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { elementId, id } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const element = await updateElement(
      id,
      elementId,
      await readProductionJson(request)
    );

    if (!element) {
      return productionErrorResponse(
        "ELEMENT_NOT_FOUND",
        "元素不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ element, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { elementId, id } = await context.params;
    const access = await requireProductionProject(id, "write");

    if ("response" in access) {
      return access.response;
    }

    const deleted = await deleteElement(id, elementId);

    if (!deleted) {
      return productionErrorResponse(
        "ELEMENT_NOT_FOUND",
        "元素不存在或不属于当前项目。",
        404
      );
    }

    return NextResponse.json({ deleted: true, ok: true });
  } catch (error) {
    return handleProductionError(error);
  }
}
