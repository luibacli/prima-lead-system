import { LayoutDashboard } from "lucide-react";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentLeads from "@/components/dashboard/RecentLeads";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <LayoutDashboard className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Overview of gathered leads for YAKAP partner onboarding
          </p>
        </div>
      </div>

      <StatsCards />

      <RecentLeads />
    </div>
  );
}
