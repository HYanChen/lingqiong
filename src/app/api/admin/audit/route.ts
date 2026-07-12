import { NextResponse } from "next/server";

import { listAdminAudits } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";

function authError(
  authorization: Extract<
    Awaited<ReturnType<typeof authorizeAdmin>>,
    { ok: false }
  >
) {
  return NextResponse.json(
    { message: authorization.message },
    { status: authorization.status }
  );
}

function readInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("audit.read");

  if (!authorization.ok) {
    return authError(authorization);
  }

  const url = new URL(request.url);
  const successParam = url.searchParams.get("success");
  const success =
    successParam === "true" ? true : successParam === "false" ? false : undefined;
  const result = await listAdminAudits({
    action: url.searchParams.get("action") || undefined,
    actor: url.searchParams.get("actor") || undefined,
    limit: readInteger(url.searchParams.get("limit"), 50),
    offset: readInteger(url.searchParams.get("offset"), 0),
    success
  });

  return NextResponse.json({ ok: true, ...result });
}
