import { NextResponse } from "next/server";

import type { SiteData } from "@/content/site";
import { hasAdminSession } from "@/lib/admin-auth";
import { getSiteData, saveSiteData } from "@/lib/site-data";

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  return NextResponse.json(await getSiteData());
}

export async function PUT(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  const data = (await request.json().catch(() => null)) as SiteData | null;

  if (!data?.brand?.name || !Array.isArray(data.works)) {
    return NextResponse.json({ message: "内容格式不正确" }, { status: 400 });
  }

  await saveSiteData(data);

  return NextResponse.json({ ok: true });
}
