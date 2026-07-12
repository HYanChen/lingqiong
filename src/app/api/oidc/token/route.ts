import { NextResponse } from "next/server";

import {
  consumeOidcAuthorizationCode,
  createOidcTicket,
  isValidOidcClient,
  isValidOidcClientCredentials,
  signOidcIdToken
} from "@/lib/oidc-provider";

function tokenError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const clientId = form?.get("client_id")?.toString() ?? "";
  const clientSecret = form?.get("client_secret")?.toString() ?? "";

  if (
    !isValidOidcClient(request.headers.get("authorization")) &&
    !isValidOidcClientCredentials(clientId, clientSecret)
  ) {
    return tokenError("invalid_client", 401);
  }

  const grantType = form?.get("grant_type")?.toString();
  const code = form?.get("code")?.toString();
  const redirectUri = form?.get("redirect_uri")?.toString();

  if (grantType !== "authorization_code") {
    return tokenError("unsupported_grant_type");
  }

  if (!code || !redirectUri) {
    return tokenError("invalid_grant");
  }

  const ticket = await consumeOidcAuthorizationCode(code, redirectUri);

  if (!ticket) {
    return tokenError("invalid_grant");
  }

  const accessToken = createOidcTicket({
    account: ticket.account,
    aud: ticket.aud,
    email: ticket.email,
    maxAge: 3600,
    name: ticket.name,
    role: ticket.role,
    sub: ticket.sub,
    type: "access"
  });

  return NextResponse.json({
    access_token: accessToken,
    expires_in: 3600,
    id_token: signOidcIdToken(ticket),
    scope: "openid profile email",
    token_type: "Bearer"
  });
}
