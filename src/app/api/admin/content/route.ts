import { NextResponse } from "next/server";

import type { SiteData } from "@/content/site";
import { recordAdminAuditSafely } from "@/lib/admin-audit";
import { authorizeAdmin } from "@/lib/admin-auth";
import { validateSiteContent } from "@/lib/site-content-validation";
import { getSiteData, saveSiteData } from "@/lib/site-data";

const teamSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTeamMembers(data: SiteData) {
  if (!Array.isArray(data.teamMembers) || data.teamMembers.length > 100) {
    return "团队成员数据格式不正确";
  }

  const slugs = new Set<string>();

  for (const [index, rawMember] of data.teamMembers.entries()) {
    const position = `第 ${index + 1} 位成员`;

    if (!isRecord(rawMember)) {
      return `${position}的数据格式不正确`;
    }

    const name = typeof rawMember.name === "string" ? rawMember.name.trim() : "";
    const role = typeof rawMember.role === "string" ? rawMember.role.trim() : "";
    const slug = typeof rawMember.slug === "string" ? rawMember.slug.trim() : "";
    const bio = typeof rawMember.bio === "string" ? rawMember.bio : "";
    const avatar = typeof rawMember.avatar === "string" ? rawMember.avatar.trim() : "";

    if (!name || name.length > 80) {
      return `${position}的姓名不能为空且不能超过 80 个字符`;
    }

    if (!role || role.length > 120) {
      return `${position}的岗位不能为空且不能超过 120 个字符`;
    }

    if (
      typeof rawMember.group !== "string" ||
      !rawMember.group.trim() ||
      rawMember.group.trim().length > 80
    ) {
      return `${position}的分组不能为空且不能超过 80 个字符`;
    }

    if (!slug || slug.length > 80 || !teamSlugPattern.test(slug)) {
      return `${position}的详情页地址只能使用小写字母、数字和单个连字符`;
    }

    if (slugs.has(slug)) {
      return `详情页地址“${slug}”重复，请为每位成员设置唯一地址`;
    }

    slugs.add(slug);

    if (bio.length > 5000 || avatar.length > 1000) {
      return `${position}的简介或照片地址过长`;
    }

    if (
      avatar &&
      !avatar.startsWith("/media/") &&
      !avatar.startsWith("https://") &&
      !avatar.startsWith("http://")
    ) {
      return `${position}的照片地址必须使用 /media/ 路径或 http(s) 地址`;
    }

    for (const values of [rawMember.expertise, rawMember.highlights]) {
      if (
        !Array.isArray(values) ||
        values.length > 30 ||
        values.some(
          (item) =>
            typeof item !== "string" ||
            !item.trim() ||
            item.trim().length > 300
        ) ||
        values.reduce(
          (total, item) => total + (typeof item === "string" ? item.length : 0),
          0
        ) > 5000
      ) {
        return `${position}的专业方向或履历亮点格式不正确`;
      }
    }
  }

  return null;
}

export async function GET() {
  const authorization = await authorizeAdmin("content.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  try {
    return NextResponse.json(await getSiteData());
  } catch {
    return NextResponse.json(
      { message: "内容数据库暂时不可用，请稍后重试" },
      { status: 503 }
    );
  }
}

export async function PUT(request: Request) {
  const authorization = await authorizeAdmin("content.write");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  const payload = await request.json().catch(() => null);
  const validation = validateSiteContent(payload);

  if (!validation.ok) {
    return NextResponse.json(
      { message: validation.message },
      { status: validation.status }
    );
  }

  const data = validation.data;

  const teamError = validateTeamMembers(data);

  if (teamError) {
    return NextResponse.json({ message: teamError }, { status: 400 });
  }

  try {
    await saveSiteData(data);
    await recordAdminAuditSafely({
      action: "content.update",
      actor: authorization.user,
      details: {
        teamMembers: data.teamMembers.length,
        works: data.works.length
      },
      request,
      targetId: "default",
      targetType: "site_content"
    });

    return NextResponse.json({ data: await getSiteData(), ok: true });
  } catch {
    return NextResponse.json(
      { message: "内容数据库暂时不可用，本次修改未保存" },
      { status: 503 }
    );
  }
}
