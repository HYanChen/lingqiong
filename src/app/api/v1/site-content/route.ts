import { NextResponse } from "next/server";

import {
  platformApiFailure,
  platformApiSuccess
} from "@/lib/platform-api-contract";
import { getSiteData } from "@/lib/site-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(platformApiSuccess(await getSiteData()), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      platformApiFailure(
        "site_content_unavailable",
        "Site content is temporarily unavailable."
      ),
      {
        headers: { "Cache-Control": "no-store" },
        status: 503
      }
    );
  }
}
