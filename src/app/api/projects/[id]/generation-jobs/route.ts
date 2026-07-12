import { NextResponse } from "next/server";

import {
  handleProductionError,
  productionListQuery,
  readProductionJson,
  requireProductionProject
} from "@/lib/production-api";
import {
  createGenerationJob,
  listGenerationJobs
} from "@/lib/production-pipeline";
import {
  LingqiongAccountError,
  requireLingqiongModelAccess
} from "@/lib/lingqiong-account";

export const runtime = "nodejs";

function accountErrorResponse(error: LingqiongAccountError) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        rechargeUrl: error.rechargeUrl
      },
      message: error.message,
      ok: false,
      rechargeUrl: error.rechargeUrl
    },
    { status: error.status }
  );
}

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
    const jobs = await listGenerationJobs(id, {
      episodeId: query.episodeId,
      limit: query.limit,
      resourceType: query.resourceType,
      status: query.status,
      taskType: query.taskType
    });
    return NextResponse.json({ jobs, ok: true });
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

    await requireLingqiongModelAccess(access.session);

    const job = await createGenerationJob(
      id,
      await readProductionJson(request, 512 * 1024),
      { account: access.session.account, id: access.session.id }
    );
    return NextResponse.json({ job, ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof LingqiongAccountError) {
      return accountErrorResponse(error);
    }

    return handleProductionError(error);
  }
}
