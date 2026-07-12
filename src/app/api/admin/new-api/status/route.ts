import { NextResponse } from "next/server";

import { authorizeAdmin } from "@/lib/admin-auth";

type NewApiStatusPayload = {
  data?: {
    system_name?: string;
    theme?: string;
    version?: string;
  };
  success?: boolean;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export async function GET() {
  const authorization = await authorizeAdmin("system.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const serverBaseUrl = trimTrailingSlash(
    process.env.NEW_API_SERVER_BASE_URL || "http://new-api:3000"
  );
  const consoleUrl = trimTrailingSlash(
    process.env.NEW_API_ADMIN_PUBLIC_URL || "http://localhost/api"
  );

  try {
    const response = await fetch(`${serverBaseUrl}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return NextResponse.json({
        consoleUrl,
        message: `灵穹 API 返回 ${response.status}`,
        online: false,
        serverBaseUrl
      });
    }

    const payload = (await response.json()) as NewApiStatusPayload;

    return NextResponse.json({
      consoleUrl,
      online: Boolean(payload.success),
      serverBaseUrl,
      systemName: payload.data?.system_name ?? "灵穹 API",
      theme: payload.data?.theme ?? "",
      version: payload.data?.version ?? ""
    });
  } catch (error) {
    return NextResponse.json({
      consoleUrl,
      message: error instanceof Error ? error.message : "灵穹 API 状态检查失败",
      online: false,
      serverBaseUrl
    });
  }
}
