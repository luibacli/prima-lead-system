"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Download, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, Eye, Globe, Mail, Phone
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import LeadStatusBadge from "./LeadStatusBadge";
import QualificationBadge from "./QualificationBadge";
import LeadModal from "./LeadModal";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import type { Lead, LeadFilters, PaginatedLeads } from "@/types/lead";

export default function LeadsTable() {
  const [data, setData] = useState<PaginatedLeads | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [filters, setFilters] = useState<LeadFilters>({
    search: "",
    status: "all",
    qualification: "all",
  });
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<keyof Lead>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.qualification) params.set("qualification", filters.qualification);
      params.set("page", page.toString());
      params.set("pageSize", "20");

      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const result: PaginatedLeads = await res.json();
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Lead>) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Update failed");
    const updated: Lead = await res.json();
    setData((prev) =>
      prev
        ? { ...prev, data: prev.data.map((l) => (l.id === id ? updated : l)) }
        : prev
    );
    setSelectedLead(updated);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    setData((prev) =>
      prev
        ? { ...prev, data: prev.data.filter((l) => l.id !== id), count: prev.count - 1 }
        : prev
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `primawell-leads-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const sortedData = [...(data?.data ?? [])].sort((a, b) => {
    const av = a[sortField] ?? "";
    const bv = b[sortField] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: keyof Lead }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ChevronDown className="h-3 w-3 text-blue-600" />
    );
  };

  const Th = ({ field, children }: { field: keyof Lead; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  );

  return (
    <>
      <Card padding="none">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100">
          <div className="flex-1">
            <Input
              placeholder="Search by company, email, address..."
              value={filters.search}
              onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value as LeadFilters["status"] })); setPage(1); }}
              className="w-40"
              options={[
                { value: "all", label: "All Status" },
                { value: "New", label: "New" },
                { value: "Reviewed", label: "Reviewed" },
                { value: "Ready for Outreach", label: "Ready for Outreach" },
              ]}
            />
            <Select
              value={filters.qualification}
              onChange={(e) => { setFilters((f) => ({ ...f, qualification: e.target.value as LeadFilters["qualification"] })); setPage(1); }}
              className="w-40"
              options={[
                { value: "all", label: "All Quality" },
                { value: "HIGH", label: "High" },
                { value: "MEDIUM", label: "Medium" },
                { value: "LOW", label: "Low" },
              ]}
            />
            <Button variant="outline" onClick={handleExport} loading={exporting} size="md">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-20">
            <LoadingSpinner label="Loading leads..." />
          </div>
        ) : sortedData.length === 0 ? (
          <EmptyState
            title="No leads found"
            description="Try adjusting your filters or run a new search to gather leads."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <Th field="company_name">Company</Th>
                  <Th field="industry">Industry</Th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
                  <Th field="qualification">Quality</Th>
                  <Th field="status">Status</Th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedData.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900 leading-tight">
                          {lead.company_name}
                        </p>
                        {lead.address && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                            {lead.address}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">{lead.industry ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1 truncate max-w-[160px]">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {lead.email}
                          </a>
                        )}
                        {lead.phone && (
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            {lead.phone}
                          </span>
                        )}
                        {lead.website && !lead.email && !lead.phone && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[160px]">
                            <Globe className="h-3 w-3 flex-shrink-0" />
                            {lead.website}
                          </a>
                        )}
                        {!lead.email && !lead.phone && !lead.website && (
                          <span className="text-xs text-slate-400">No contact info</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <QualificationBadge qualification={lead.qualification} />
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.count)} of {data.count} leads
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <LeadModal
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  );
}
