import { NextResponse } from "next/server";
import type { Database } from "sql.js";

import { hasAdminSession } from "@/lib/admin-auth";
import { DATABASE_PATH, getFirstRow, getRows, readDatabase } from "@/lib/database";
import { seedInviteCodes } from "@/lib/invite-codes";
import { ensureModelApiSchema } from "@/lib/model-apis";
import { getSiteData } from "@/lib/site-data";

type CountRow = {
  total: number;
};

function countTable(table: string) {
  return (db: Database) => {
    const row = getFirstRow<CountRow>(db, `SELECT COUNT(*) AS total FROM ${table}`);
    return Number(row?.total ?? 0);
  };
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ message: "未登录" }, { status: 401 });
  }

  await getSiteData();
  await seedInviteCodes();
  await ensureModelApiSchema();

  const stats = await readDatabase((db) => ({
    counts: {
      frontUsers: countTable("front_users")(db),
      inviteCodes: countTable("invite_codes")(db),
      modelApiCalls: countTable("model_api_calls")(db),
      modelApis: countTable("model_api_configs")(db),
      projects: countTable("projects")(db),
      siteContent: countTable("site_content")(db)
    },
    inviteCodes: getRows<{
      active: number;
      code: string;
      label: string | null;
      updated_at: string;
      used_count: number;
    }>(
      db,
      `SELECT code, label, active, used_count, updated_at
       FROM invite_codes
       ORDER BY updated_at DESC
       LIMIT 12`
    ).map((item) => ({
      active: Boolean(item.active),
      code: item.code,
      label: item.label,
      updatedAt: item.updated_at,
      usedCount: Number(item.used_count)
    })),
    path: DATABASE_PATH,
    recentProjects: getRows<{
      created_at: string;
      id: string;
      name: string;
      owner_account: string | null;
      type: string;
    }>(
      db,
      `SELECT id, name, type, owner_account, created_at
       FROM projects
       ORDER BY created_at DESC
       LIMIT 8`
    ).map((item) => ({
      createdAt: item.created_at,
      id: item.id,
      name: item.name,
      ownerAccount: item.owner_account,
      type: item.type
    })),
    recentUsers: getRows<{
      account: string;
      contact: string | null;
      created_at: string;
      id: string;
      invite_code: string | null;
      profile: string | null;
    }>(
      db,
      `SELECT id, account, contact, profile, invite_code, created_at
       FROM front_users
       ORDER BY created_at DESC
       LIMIT 8`
    ).map((item) => ({
      account: item.account,
      contact: item.contact,
      createdAt: item.created_at,
      id: item.id,
      inviteCode: item.invite_code,
      profile: item.profile
    }))
  }));

  return NextResponse.json(stats);
}
