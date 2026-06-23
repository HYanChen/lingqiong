import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "后台管理",
  description: "战纪宇宙官网内容后台。"
};

export default function AdminPage() {
  return <AdminDashboard />;
}
