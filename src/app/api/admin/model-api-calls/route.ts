import { NextResponse } from "next/server";

import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";
import { listModelApiCalls, purgeModelApiCalls } from "@/lib/model-apis";

export const runtime = "nodejs";

function positiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("modelApi.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message, ok: false },
      { status: authorization.status }
    );
  }

  const url = new URL(request.url);
  const days = positiveInteger(url.searchParams.get("days"), 30);
  const limit = positiveInteger(url.searchParams.get("limit"), 50);

  if (!Number.isInteger(days) || !Number.isInteger(limit)) {
    return NextResponse.json(
      { message: "days 和 limit 必须是正整数。", ok: false },
      { status: 400 }
    );
  }

  const calls = await listModelApiCalls({
    configId: url.searchParams.get("configId")?.trim() || undefined,
    days,
    limit
  });

  return NextResponse.json({ calls, days: Math.min(3650, days), ok: true });
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdmin("modelApi.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message, ok: false },
      { status: authorization.status }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    retentionDays?: number;
  } | null;

  if (
    body?.retentionDays !== undefined &&
    (!Number.isInteger(body.retentionDays) || body.retentionDays < 30)
  ) {
    return NextResponse.json(
      { message: "调用日志至少保留 30 天。", ok: false },
      { status: 400 }
    );
  }

  const result = await purgeModelApiCalls(body?.retentionDays);
  await recordAdminAuditSafely({
    action: "model_api.calls.purge",
    actor: authorization.user,
    details: result,
    request,
    targetType: "model_api_calls"
  });

  return NextResponse.json({ ok: true, ...result });
}
