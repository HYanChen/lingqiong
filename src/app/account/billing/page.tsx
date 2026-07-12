import type { Metadata } from "next";

import { BillingCenter } from "@/components/account/billing-center";

export const metadata: Metadata = {
  description: "管理灵穹 API 资源余额、充值支付、兑换码和历史订单。",
  title: "充值与账单"
};

export default function AccountBillingPage() {
  return <BillingCenter />;
}
