import { Users } from "lucide-react";
import LeadsTable from "@/components/leads/LeadsTable";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Users className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">All Leads</h1>
          <p className="text-sm text-slate-500">
            Search, filter, update, and export your gathered leads
          </p>
        </div>
      </div>

      <LeadsTable />
    </div>
  );
}
