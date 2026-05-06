"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import QualificationBadge from "@/components/leads/QualificationBadge";
import LeadStatusBadge from "@/components/leads/LeadStatusBadge";
import type { Lead } from "@/types/lead";
import { formatDate } from "@/lib/utils";

export default function RecentLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads?page=1&pageSize=5")
      .then((r) => r.json())
      .then((d) => setLeads(d.data ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Recent Leads</h2>
        <Link
          href="/leads"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="py-10">
          <LoadingSpinner size="sm" />
        </div>
      ) : leads.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-500">No leads yet. Run a search to get started.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{lead.company_name}</p>
                <p className="text-xs text-slate-400">{lead.industry ?? "—"} · {formatDate(lead.created_at)}</p>
              </div>
              <QualificationBadge qualification={lead.qualification} />
              <LeadStatusBadge status={lead.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
