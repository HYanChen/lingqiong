import { NextResponse } from "next/server";

import { oidcPublicJwks } from "@/lib/oidc-provider";

export async function GET() {
  return NextResponse.json(oidcPublicJwks());
}
