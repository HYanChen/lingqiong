import type { Metadata } from "next";

import { WechatConfirm } from "@/components/auth/wechat-confirm";
import { getPlatformSiteData } from "@/lib/platform-api-client";

export const metadata: Metadata = {
  title: "微信扫码确认",
  description: "战纪宇宙统一登录微信扫码确认页。"
};

export default async function WechatLoginPage() {
  const { brand } = await getPlatformSiteData();

  return <WechatConfirm brandName={brand.name} />;
}
