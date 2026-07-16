import { Suspense } from "react";

import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#05070a] px-5 text-sm text-stone-400">
          正在进入战纪宇宙运营后台…
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
