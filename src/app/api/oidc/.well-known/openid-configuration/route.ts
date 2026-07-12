import { NextResponse } from "next/server";

import {
  internalOidcPath,
  oidcIssuer,
  publicOidcPath
} from "@/lib/oidc-provider";

export async function GET() {
  return NextResponse.json({
    authorization_endpoint: publicOidcPath("/authorize"),
    claims_supported: ["sub", "name", "email", "groups", "role"],
    end_session_endpoint: publicOidcPath("/logout"),
    grant_types_supported: ["authorization_code"],
    id_token_signing_alg_values_supported: ["RS256"],
    issuer: oidcIssuer(),
    jwks_uri: internalOidcPath("/keys"),
    response_types_supported: ["code"],
    scopes_supported: ["openid", "profile", "email"],
    subject_types_supported: ["public"],
    token_endpoint: internalOidcPath("/token"),
    token_endpoint_auth_methods_supported: ["client_secret_basic"],
    userinfo_endpoint: internalOidcPath("/userinfo")
  });
}
