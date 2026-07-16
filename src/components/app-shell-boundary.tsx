"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellBoundaryProps = {
  children: ReactNode;
  footer: ReactNode;
  header: ReactNode;
};

const nestedSiteShellPrefixes = ["/account", "/create", "/projects"];
const standalonePrefixes = ["/admin", "/api", "/knowledge", "/wechat-login"];

function pathMatchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * The root layout stays mounted during client navigation, so its server-side
 * request pathname becomes stale. Decide at this client boundary whether the
 * current route needs the public shell to prevent missing or duplicate chrome.
 */
function usesOwnOrStandaloneShell(pathname: string) {
  return (
    nestedSiteShellPrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix)) ||
    standalonePrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))
  );
}

export function AppShellBoundary({
  children,
  footer,
  header
}: AppShellBoundaryProps) {
  const pathname = usePathname();

  if (usesOwnOrStandaloneShell(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      {header}
      <main>{children}</main>
      {footer}
    </>
  );
}
