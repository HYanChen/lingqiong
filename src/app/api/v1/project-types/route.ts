import { NextResponse } from "next/server";

import {
  platformApiFailure,
  platformApiSuccess
} from "@/lib/platform-api-contract";
import { listProjectTypes } from "@/lib/project-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const types = await listProjectTypes({ activeOnly: true });

    return NextResponse.json(platformApiSuccess(types), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      platformApiFailure(
        "project_types_unavailable",
        "Project types are temporarily unavailable."
      ),
      {
        headers: { "Cache-Control": "no-store" },
        status: 503
      }
    );
  }
}
