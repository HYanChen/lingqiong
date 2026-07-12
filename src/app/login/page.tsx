import type { Metadata } from "next";

import { PlatformLogin } from "@/components/auth/platform-login";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export const metadata: Metadata = {
  title: "用户登录",
  description: "战纪宇宙用户登录入口，支持账号密码、微信扫码与第三方账号。"
};

export default async function LoginPage() {
  const { brand, media } = await getPlatformSiteData();

  return <PlatformLogin brand={brand} media={media} />;
}
