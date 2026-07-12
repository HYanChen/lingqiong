import { NextResponse } from "next/server";

import {
  platformApiFailure,
  platformApiSuccess
} from "@/lib/platform-api-contract";
import { listProjectTypes } from "@/lib/project-types";
import { getSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store"
};

export async function GET() {
  try {
    await Promise.all([
      getSiteData(),
      listProjectTypes({ activeOnly: true })
    ]);

    return NextResponse.json(
      platformApiSuccess({
        checks: {
          projectTypes: "ok",
          siteContent: "ok"
        },
        service: "platform-api",
        status: "ok"
      }),
      { headers: noStoreHeaders }
    );
  } catch {
    return NextResponse.json(
      platformApiFailure(
        "repository_unavailable",
        "Platform repositories are temporarily unavailable."
      ),
      { headers: noStoreHeaders, status: 503 }
    );
  }
}
