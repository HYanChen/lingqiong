import type { Metadata } from "next";

import { ApiEntryRedirect } from "@/components/api/api-entry-redirect";
import { safeInternalRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  description: "进入灵穹 API 用户端。",
  title: "灵穹 API | 战纪宇宙"
};

export default async function ApiEntryPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeInternalRedirectPath(params.redirect, "/dashboard");

  return (
    <ApiEntryRedirect
      clientId={process.env.WCU_OIDC_CLIENT_ID || "zhanji-bookstack"}
      returnTo={returnTo}
    />
  );
}
