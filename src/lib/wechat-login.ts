import { randomBytes, randomUUID } from "node:crypto";

import {
  getFirstRow,
  readDatabase,
  writeDatabase,
  type Database
} from "@/lib/database";
import {
  findOrCreateFrontUserIdentityInDatabase,
  type StoredFrontUser
} from "@/lib/front-users";

const TICKET_TTL_MS = 1000 * 60 * 5;

export type WechatTicketStatus = "confirmed" | "consumed" | "expired" | "pending";

export type WechatLoginTicket = {
  code: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  scannedAccount?: string;
  scannedContact?: string;
  status: WechatTicketStatus;
  updatedAt: string;
};

type TicketRow = {
  code: string;
  created_at: string;
  expires_at: string;
  id: string;
  scanned_account: string | null;
  scanned_contact: string | null;
  status: WechatTicketStatus;
  updated_at: string;
};

function mapTicket(row: TicketRow): WechatLoginTicket {
  return {
    code: row.code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    scannedAccount: row.scanned_account ?? undefined,
    scannedContact: row.scanned_contact ?? undefined,
    status: row.status,
    updatedAt: row.updated_at
  };
}

function nowIso() {
  return new Date().toISOString();
}

function newCode() {
  return randomBytes(18).toString("base64url");
}

function isExpired(ticket: WechatLoginTicket) {
  return ticket.expiresAt < nowIso();
}

async function findTicket(db: Database, code: string) {
  const row = await getFirstRow<TicketRow>(
    db,
    `SELECT id, code, status, scanned_account, scanned_contact, expires_at, created_at, updated_at
     FROM wechat_login_tickets
     WHERE code = ?
     LIMIT 1`,
    [code]
  );

  return row ? mapTicket(row) : null;
}

async function markExpired(db: Database, ticket: WechatLoginTicket) {
  const updatedAt = nowIso();

  await db.execute(
    `UPDATE wechat_login_tickets
     SET status = 'expired', updated_at = ?
     WHERE code = ? AND status <> 'consumed'`,
    [updatedAt, ticket.code]
  );

  return { ...ticket, status: "expired" as const, updatedAt };
}

export async function createWechatLoginTicket() {
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS).toISOString();
  const ticket: WechatLoginTicket = {
    code: newCode(),
    createdAt,
    expiresAt,
    id: randomUUID(),
    status: "pending",
    updatedAt: createdAt
  };

  await writeDatabase(async (db) => {
    await db.execute(
      `DELETE FROM wechat_login_tickets
       WHERE expires_at < ? OR status IN ('consumed', 'expired')`,
      [createdAt]
    );
    await db.execute(
      `INSERT INTO wechat_login_tickets (
        id, code, status, scanned_account, scanned_contact, expires_at, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticket.id,
        ticket.code,
        ticket.status,
        null,
        null,
        ticket.expiresAt,
        ticket.createdAt,
        ticket.updatedAt
      ]
    );
  });

  return ticket;
}

export async function getWechatLoginTicket(code: string) {
  const normalized = code.trim();

  if (!normalized) {
    return null;
  }

  return readDatabase(async (db) => {
    const ticket = await findTicket(db, normalized);

    if (!ticket) {
      return null;
    }

    if (ticket.status !== "consumed" && ticket.status !== "expired" && isExpired(ticket)) {
      return markExpired(db, ticket);
    }

    return ticket;
  });
}

export async function confirmWechatLoginTicket({
  account,
  code,
  contact
}: {
  account: string;
  code: string;
  contact?: string;
}) {
  const normalized = code.trim();

  if (!normalized) {
    return null;
  }

  return writeDatabase(async (db) => {
    const ticket = await findTicket(db, normalized);

    if (!ticket) {
      return null;
    }

    if (ticket.status !== "consumed" && ticket.status !== "expired" && isExpired(ticket)) {
      return markExpired(db, ticket);
    }

    if (ticket.status === "consumed" || ticket.status === "expired") {
      return ticket;
    }

    const updatedAt = nowIso();
    await db.execute(
      `UPDATE wechat_login_tickets
       SET status = 'confirmed', scanned_account = ?, scanned_contact = ?, updated_at = ?
       WHERE code = ?`,
      [account.trim() || "微信创作者", contact?.trim() || null, updatedAt, normalized]
    );

    return {
      ...ticket,
      scannedAccount: account.trim() || "微信创作者",
      scannedContact: contact?.trim() || undefined,
      status: "confirmed" as const,
      updatedAt
    };
  });
}

export async function consumeWechatLoginTicket({
  fallbackAccount,
  fallbackContact,
  code
}: {
  code: string;
  fallbackAccount: string;
  fallbackContact?: string;
}): Promise<{ ticket: WechatLoginTicket | null; user?: StoredFrontUser }> {
  const normalized = code.trim();

  if (!normalized) {
    return { ticket: null };
  }

  return writeDatabase(async (db) => {
    const ticket = await findTicket(db, normalized);

    if (!ticket) {
      return { ticket: null };
    }

    if (ticket.status !== "consumed" && ticket.status !== "expired" && isExpired(ticket)) {
      return { ticket: await markExpired(db, ticket) };
    }

    if (ticket.status !== "confirmed") {
      return { ticket };
    }

    const providerSubject =
      ticket.scannedContact || fallbackContact || ticket.scannedAccount || fallbackAccount;
    const user = await findOrCreateFrontUserIdentityInDatabase(db, {
      account: ticket.scannedAccount || fallbackAccount,
      contact: ticket.scannedContact || fallbackContact,
      profile: "微信扫码登录",
      provider: "wechat",
      providerSubject
    });
    const updatedAt = nowIso();

    await db.execute(
      `UPDATE wechat_login_tickets
       SET status = 'consumed', updated_at = ?
       WHERE code = ?`,
      [updatedAt, normalized]
    );

    return {
      ticket: {
        ...ticket,
        status: "consumed" as const,
        updatedAt
      },
      user
    };
  });
}
