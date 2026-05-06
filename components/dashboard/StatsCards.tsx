"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, Minus, TrendingDown, CheckCircle2, Clock, Send } from "lucide-react";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils";

interface Stats {
  total: number;
  high: number;
  medium: number;
  low: number;
  new: number;
  reviewed: number;
  ready: number;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, iconBg, iconColor, subtitle }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className={cn("flex-shrink-0 p-3 rounded-xl", iconBg)}>
        <Icon className={cn("h-6 w-6", iconColor)} />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </Card>
  );
}

export default function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Card key={i} className="h-24 flex items-center justify-center">
            <LoadingSpinner size="sm" />
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={stats.total}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          subtitle="All gathered leads"
        />
        <StatCard
          title="High Potential"
          value={stats.high}
          icon={TrendingUp}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          subtitle="Complete contact info"
        />
        <StatCard
          title="Medium Potential"
          value={stats.medium}
          icon={Minus}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          subtitle="Partial contact info"
        />
        <StatCard
          title="Low Potential"
          value={stats.low}
          icon={TrendingDown}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          subtitle="Missing most contact info"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="New"
          value={stats.new}
          icon={Clock}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          subtitle="Awaiting review"
        />
        <StatCard
          title="Reviewed"
          value={stats.reviewed}
          icon={CheckCircle2}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          subtitle="Internal review done"
        />
        <StatCard
          title="Ready for Outreach"
          value={stats.ready}
          icon={Send}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          subtitle="Cleared for contact"
        />
      </div>
    </div>
  );
}
