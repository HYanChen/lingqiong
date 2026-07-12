import { NextResponse } from "next/server";

import { readOidcTicket } from "@/lib/oidc-provider";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const ticket = readOidcTicket(token, "access");

  if (!ticket) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  return NextResponse.json({
    email: ticket.email,
    groups: ticket.role === "admin" ? ["admin", "creator"] : ["creator"],
    name: ticket.name,
    preferred_username: ticket.account,
    role: ticket.role,
    sub: ticket.sub
  });
}
