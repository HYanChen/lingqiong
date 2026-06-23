import { getFirstRow, readDatabase, writeDatabase } from "@/lib/database";

export const defaultInviteCodes = ["WCU-2026", "HUOZHONG-001", "LINGQIONG-AI"];

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function getInviteCodes() {
  const configuredCodes = process.env.WCU_INVITE_CODES?.split(",") ?? defaultInviteCodes;

  return Array.from(new Set(configuredCodes.map(normalizeInviteCode).filter(Boolean)));
}

export async function seedInviteCodes() {
  const codes = getInviteCodes();
  const missingCodes = await readDatabase((db) =>
    codes.filter((code) => {
      const row = getFirstRow<{ code: string }>(
        db,
        "SELECT code FROM invite_codes WHERE code = ?",
        [code]
      );

      return !row?.code;
    })
  );

  if (!missingCodes.length) {
    return;
  }

  await writeDatabase((db) => {
    const now = new Date().toISOString();

    for (const code of missingCodes) {
      db.run(
        `INSERT INTO invite_codes (code, label, active, used_count, created_at, updated_at)
         VALUES (?, ?, 1, 0, ?, ?)`,
        [code, "默认邀请码", now, now]
      );
    }
  });
}

export async function isValidInviteCode(value: string) {
  const code = normalizeInviteCode(value);

  if (!code) {
    return false;
  }

  await seedInviteCodes();

  return readDatabase((db) => {
    const row = getFirstRow<{ code: string }>(
      db,
      "SELECT code FROM invite_codes WHERE code = ? AND active = 1",
      [code]
    );

    return Boolean(row?.code);
  });
}
