import Badge from "@/components/ui/Badge";
import type { LeadStatus } from "@/types/lead";

interface LeadStatusBadgeProps {
  status: LeadStatus;
}

export default function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const config: Record<LeadStatus, { variant: "info" | "purple" | "success"; label: string }> = {
    New: { variant: "info", label: "New" },
    Reviewed: { variant: "purple", label: "Reviewed" },
    "Ready for Outreach": { variant: "success", label: "Ready for Outreach" },
  };

  const { variant, label } = config[status] ?? { variant: "default", label: status };

  return <Badge variant={variant}>{label}</Badge>;
}
