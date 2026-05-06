"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Download, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, Eye, Globe, Mail, Phone,
  Trash2, AlertTriangle, X, Check,
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

  // Per-row delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);

  // Delete All state
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

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
      prev ? { ...prev, data: prev.data.map((l) => (l.id === id ? updated : l)) } : prev
    );
    setSelectedLead(updated);
  };

  // Used by the modal
  const handleDeleteFromModal = async (id: string) => {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    setData((prev) =>
      prev
        ? { ...prev, data: prev.data.filter((l) => l.id !== id), count: prev.count - 1 }
        : prev
    );
  };

  // Used by the inline row button
  const handleDeleteRow = async (id: string) => {
    setDeletingRowId(id);
    try {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setData((prev) =>
        prev
          ? { ...prev, data: prev.data.filter((l) => l.id !== id), count: prev.count - 1 }
          : prev
      );
    } finally {
      setDeletingRowId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const res = await fetch("/api/leads", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete all failed");
      setData((prev) => (prev ? { ...prev, data: [], count: 0, totalPages: 0 } : prev));
      setShowDeleteAll(false);
      setPage(1);
    } finally {
      setDeletingAll(false);
    }
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

  const totalCount = data?.count ?? 0;

  return (
    <>
      <Card padding="none">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100">
          <div className="flex-1">
            <Input
              placeholder="Search by company, email, address..."
              value={filters.search}
              onChange={(e) => {
                setFilters((f) => ({ ...f, search: e.target.value }));
                setPage(1);
              }}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select
              value={filters.status}
              onChange={(e) => {
                setFilters((f) => ({ ...f, status: e.target.value as LeadFilters["status"] }));
                setPage(1);
              }}
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
              onChange={(e) => {
                setFilters((f) => ({
                  ...f,
                  qualification: e.target.value as LeadFilters["qualification"],
                }));
                setPage(1);
              }}
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
            {totalCount > 0 && (
              <Button
                variant="danger"
                size="md"
                onClick={() => setShowDeleteAll(true)}
                disabled={showDeleteAll}
              >
                <Trash2 className="h-4 w-4" />
                Delete All
              </Button>
            )}
          </div>
        </div>

        {/* Delete All confirmation banner */}
        {showDeleteAll && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800 font-medium">
                Permanently delete all{" "}
                <span className="font-bold">{totalCount.toLocaleString()}</span>{" "}
                {totalCount === 1 ? "lead" : "leads"}? This cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteAll(false)}
                disabled={deletingAll}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteAll}
                loading={deletingAll}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Yes, delete all
              </Button>
            </div>
          </div>
        )}

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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Contact
                  </th>
                  <Th field="qualification">Quality</Th>
                  <Th field="status">Status</Th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedData.map((lead) => {
                  const isConfirming = confirmDeleteId === lead.id;
                  const isDeleting = deletingRowId === lead.id;

                  return (
                    <tr
                      key={lead.id}
                      className={`transition-colors ${
                        isConfirming ? "bg-red-50" : "hover:bg-slate-50/50"
                      }`}
                    >
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
                            <a
                              href={`mailto:${lead.email}`}
                              className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1 truncate max-w-[160px]"
                            >
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
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[160px]"
                            >
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

                      {/* Actions cell */}
                      <td className="px-4 py-3">
                        {isConfirming ? (
                          // Inline confirmation state
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                              Delete?
                            </span>
                            <button
                              onClick={() => handleDeleteRow(lead.id)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              {isDeleting ? (
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                            >
                              <X className="h-3 w-3" />
                              No
                            </button>
                          </div>
                        ) : (
                          // Normal action buttons
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLead(lead)}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                            <button
                              onClick={() => {
                                setConfirmDeleteId(lead.id);
                                setShowDeleteAll(false);
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete lead"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.count)} of{" "}
              {data.count} leads
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
        onDelete={handleDeleteFromModal}
      />
    </>
  );
}
