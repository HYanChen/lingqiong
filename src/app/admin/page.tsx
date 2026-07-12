import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "管理后台",
  description: "战纪宇宙授权管理员登录与管理后台。",
  robots: {
    follow: false,
    index: false
  }
};

export default function AdminPage() {
  return <AdminDashboard />;
}
