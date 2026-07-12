import type { Metadata } from "next";

import { InviteRegister } from "@/components/auth/invite-register";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export const metadata: Metadata = {
  title: "邀请码注册",
  description: "通过邀请码注册战纪宇宙创作者工作台。"
};

export default async function RegisterPage() {
  const { brand, media } = await getPlatformSiteData();

  return <InviteRegister brand={brand} media={media} />;
}
