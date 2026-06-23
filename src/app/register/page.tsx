import type { Metadata } from "next";

import { InviteRegister } from "@/components/auth/invite-register";
import { getSiteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "邀请码注册",
  description: "通过邀请码注册战纪宇宙创作者工作台。"
};

export default async function RegisterPage() {
  const { brand, media } = await getSiteData();

  return <InviteRegister brand={brand} media={media} />;
}
