import { randomUUID } from "node:crypto";

import { normalizeInviteCode } from "@/lib/invite-codes";
import { writeDatabase } from "@/lib/database";

export type CreateFrontUserInput = {
  account: string;
  contact?: string;
  inviteCode?: string;
  profile?: string;
  source: "login" | "demo" | "invite";
};

export type StoredFrontUser = CreateFrontUserInput & {
  createdAt: string;
  id: string;
};

export async function createFrontUser(input: CreateFrontUserInput) {
  const user: StoredFrontUser = {
    ...input,
    account: input.account.trim() || "受邀创作者",
    contact: input.contact?.trim(),
    createdAt: new Date().toISOString(),
    id: randomUUID(),
    inviteCode: input.inviteCode ? normalizeInviteCode(input.inviteCode) : undefined,
    profile: input.profile?.trim()
  };

  await writeDatabase((db) => {
    db.run(
      `INSERT INTO front_users (
        id, account, contact, profile, invite_code, source, created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.account,
        user.contact ?? null,
        user.profile ?? null,
        user.inviteCode ?? null,
        user.source,
        user.createdAt
      ]
    );

    if (user.inviteCode) {
      db.run(
        `UPDATE invite_codes
         SET used_count = used_count + 1, updated_at = ?
         WHERE code = ?`,
        [user.createdAt, user.inviteCode]
      );
    }
  });

  return user;
}
