"use client";

import { useState } from "react";
import {
  Building2, Mail, Phone, Globe, MapPin, Facebook,
  ExternalLink, Save, Trash2
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import LeadStatusBadge from "./LeadStatusBadge";
import QualificationBadge from "./QualificationBadge";
import type { Lead, LeadStatus } from "@/types/lead";
import { formatDate, normalizeUrl } from "@/lib/utils";

interface LeadModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Lead>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function LeadModal({ lead, open, onClose, onUpdate, onDelete }: LeadModalProps) {
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "New");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!lead) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(lead.id, { notes: notes.trim() || null, status });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${lead.company_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(lead.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const InfoRow = ({
    icon: Icon,
    label,
    value,
    href,
  }: {
    icon: React.ElementType;
    label: string;
    value: string | null;
    href?: string;
  }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">
            {label}
          </p>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 truncate"
            >
              {value}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          ) : (
            <p className="text-sm text-slate-700">{value}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Lead Details" size="xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column — company info */}
        <div>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{lead.company_name}</h3>
              {lead.industry && (
                <p className="text-sm text-slate-500">{lead.industry}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <QualificationBadge qualification={lead.qualification} showDot />
            <LeadStatusBadge status={lead.status} />
          </div>

          {lead.qualification_reason && (
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-slate-500 mb-0.5">Qualification Reason</p>
              <p className="text-sm text-slate-700">{lead.qualification_reason}</p>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-100">
            <InfoRow icon={Mail} label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
            <InfoRow icon={Phone} label="Phone" value={lead.phone} />
            <InfoRow icon={Globe} label="Website" value={lead.website} href={lead.website ? normalizeUrl(lead.website) : undefined} />
            <InfoRow icon={Facebook} label="Facebook" value={lead.facebook} href={lead.facebook ?? undefined} />
            <InfoRow icon={MapPin} label="Address" value={lead.address} />
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Added {formatDate(lead.created_at)}
          </p>
        </div>

        {/* Right column — notes & status */}
        <div className="flex flex-col gap-4">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
            options={[
              { value: "New", label: "New" },
              { value: "Reviewed", label: "Reviewed" },
              { value: "Ready for Outreach", label: "Ready for Outreach" },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={8}
              placeholder="Add notes about this lead..."
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} loading={saving} className="flex-1">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
