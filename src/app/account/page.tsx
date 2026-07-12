import type { Metadata } from "next";

import { AccountOverview } from "@/components/account/account-overview";

export const metadata: Metadata = {
  description: "管理灵穹创作者资料、模型资源和平台连接。",
  title: "用户中心"
};

export default function AccountPage() {
  return <AccountOverview />;
}
