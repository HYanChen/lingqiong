import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionListQuery,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import { createElement, listElements } from "@/lib/production-pipeline";

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
    const elements = await listElements(id, {
      episodeId: query.episodeId,
      kind: query.kind
    });

    return NextResponse.json({ elements, ok: true });
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

    const element = await createElement(id, await readProductionJson(request));
    return NextResponse.json({ element, ok: true }, { status: 201 });
  } catch (error) {
    return handleProductionError(error);
  }
}
