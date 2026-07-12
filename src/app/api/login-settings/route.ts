import { NextResponse } from "next/server";

import { getPublicLoginSettings } from "@/lib/login-settings";

export async function GET() {
  return NextResponse.json(await getPublicLoginSettings());
}
