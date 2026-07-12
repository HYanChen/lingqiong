import { NextResponse } from "next/server";

import { listProjectTypes } from "@/lib/project-types";

export async function GET() {
  return NextResponse.json({
    ok: true,
    types: await listProjectTypes({ activeOnly: true })
  });
}
