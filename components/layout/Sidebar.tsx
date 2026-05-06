"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Users, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search Leads", icon: Search },
  { href: "/leads", label: "All Leads", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 bg-white border-r border-slate-200 min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <div className="flex-shrink-0 h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center">
          <Heart className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 leading-tight">PrimaWell</p>
          <p className="text-xs text-slate-500 leading-tight">Lead Intelligence</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-blue-600" : "text-slate-400")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-900">YAKAP Program</p>
          <p className="text-xs text-blue-600 mt-0.5 leading-tight">
            Employee wellness onboarding initiative
          </p>
        </div>
        <p className="text-xs text-slate-400 mt-3 text-center">Internal use only</p>
      </div>
    </aside>
  );
}
