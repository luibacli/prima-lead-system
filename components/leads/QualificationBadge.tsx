import Badge from "@/components/ui/Badge";
import type { LeadQualification } from "@/types/lead";

interface QualificationBadgeProps {
  qualification: LeadQualification;
  showDot?: boolean;
}

export default function QualificationBadge({ qualification, showDot }: QualificationBadgeProps) {
  const config: Record<LeadQualification, { variant: "success" | "warning" | "danger"; dot: string }> = {
    HIGH: { variant: "success", dot: "bg-green-500" },
    MEDIUM: { variant: "warning", dot: "bg-amber-500" },
    LOW: { variant: "danger", dot: "bg-red-500" },
  };

  const { variant, dot } = config[qualification];

  return (
    <Badge variant={variant}>
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${dot} mr-1`} />}
      {qualification}
    </Badge>
  );
}
