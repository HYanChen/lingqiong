import { NextResponse, type NextRequest } from "next/server";

const platformSessionCookieName = "wcu_platform_session";
const protectedPagePrefixes = [
  "/account",
  "/create",
  "/knowledge",
  "/projects",
  "/skills"
];
const protectedExactPages = ["/api"];

function isProtectedPage(pathname: string) {
  return (
    protectedExactPages.includes(pathname) ||
    protectedPagePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isProtectedPage(pathname) && !request.cookies.get(platformSessionCookieName)?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);

    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-wcu-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media/|.*\\..*).*)"]
};
