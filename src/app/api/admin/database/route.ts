import { NextResponse } from "next/server";

import { authorizeAdmin } from "@/lib/admin-auth";
import {
  DATABASE_PATH,
  getFirstRow,
  getRows,
  readDatabase,
  type Database
} from "@/lib/database";
import { seedInviteCodes } from "@/lib/invite-codes";
import { ensureModelApiSchema } from "@/lib/model-apis";
import { getSiteData } from "@/lib/site-data";
import { ensureSkillWorkbenchSeeded } from "@/lib/skill-workbench";

type CountRow = {
  total: number;
};

function countTable(table: string) {
  return async (db: Database) => {
    const row = await getFirstRow<CountRow>(db, `SELECT COUNT(*) AS total FROM ${table}`);
    return Number(row?.total ?? 0);
  };
}

function maskValue(value: string | null, visibleEnd = 3) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length <= visibleEnd) {
    return "••••";
  }

  return `${trimmed.slice(0, Math.min(2, trimmed.length - visibleEnd))}••••${trimmed.slice(-visibleEnd)}`;
}

function maskContact(value: string | null) {
  if (!value) {
    return null;
  }

  const at = value.indexOf("@");

  if (at > 0) {
    return `${value.slice(0, Math.min(2, at))}••••${value.slice(at)}`;
  }

  return maskValue(value, 4);
}

export async function GET() {
  const authorization = await authorizeAdmin("database.read");

  if (!authorization.ok) {
    return NextResponse.json(
      { message: authorization.message },
      { status: authorization.status }
    );
  }

  if (
    authorization.user.role !== "owner" &&
    authorization.user.role !== "admin"
  ) {
    return NextResponse.json(
      { message: "仅所有者或管理员可查看数据库概览。" },
      { status: 403 }
    );
  }

  await getSiteData();
  await seedInviteCodes();
  await ensureModelApiSchema();
  await ensureSkillWorkbenchSeeded();

  const stats = await readDatabase(async (db) => ({
    counts: {
      apiAccountLinks: await countTable("api_account_links")(db),
      billingAudits: await countTable("model_billing_audits")(db),
      frontUsers: await countTable("front_users")(db),
      inviteCodes: await countTable("invite_codes")(db),
      modelApiCalls: await countTable("model_api_calls")(db),
      modelApis: await countTable("model_api_configs")(db),
      projectTypes: await countTable("project_types")(db),
      projects: await countTable("projects")(db),
      payments: await countTable("wechat_pay_orders")(db),
      skillRuns: await countTable("skill_runs")(db),
      skillTools: await countTable("skill_tools")(db),
      siteContent: await countTable("site_content")(db)
    },
    inviteCodes: (
      await getRows<{
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
      )
    ).map((item) => ({
      active: Boolean(item.active),
      code: maskValue(item.code, 3) ?? "••••",
      label: item.label,
      updatedAt: item.updated_at,
      usedCount: Number(item.used_count)
    })),
    path: DATABASE_PATH,
    recentProjects: (
      await getRows<{
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
      )
    ).map((item) => ({
      createdAt: item.created_at,
      id: item.id,
      name: item.name,
      ownerAccount: maskValue(item.owner_account),
      type: item.type
    })),
    recentPayments: (
      await getRows<{
        amount_fen: number;
        created_at: string;
        principal_id: string;
        status: string;
        trade_no: string;
      }>(
        db,
        `SELECT trade_no, principal_id, amount_fen, status, created_at
         FROM wechat_pay_orders
         ORDER BY created_at DESC
         LIMIT 8`
      )
    ).map((item) => ({
      amount: `¥${(Number(item.amount_fen) / 100).toFixed(2)}`,
      createdAt: item.created_at,
      principalId: maskValue(item.principal_id, 4) ?? "••••",
      status: item.status,
      tradeNo: maskValue(item.trade_no, 4) ?? "••••"
    })),
    recentUsers: (
      await getRows<{
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
      )
    ).map((item) => ({
      account: item.account,
      contact: maskContact(item.contact),
      createdAt: item.created_at,
      id: item.id,
      inviteCode: maskValue(item.invite_code),
      profile: item.profile ? "已填写" : null
    }))
  }));

  return NextResponse.json(stats);
}
