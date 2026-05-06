"use client";

import { useState } from "react";
import {
  Search, Loader2, CheckCircle2, AlertCircle, ChevronDown,
  Terminal, MapPin, Filter, Hash,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import QualificationBadge from "@/components/leads/QualificationBadge";
import { buildSearchQuery } from "@/lib/query-builder";
import type { Lead, ScrapeResult, ScrapeLog } from "@/types/lead";

const INDUSTRY_OPTIONS = [
  { value: "", label: "Select industry..." },
  { value: "BPO / Call Center", label: "BPO / Call Center" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Logistics / Shipping", label: "Logistics / Shipping" },
  { value: "Retail / Trade", label: "Retail / Trade" },
  { value: "Construction", label: "Construction" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Food & Beverage", label: "Food & Beverage" },
  { value: "IT / Software", label: "IT / Software" },
  { value: "Finance / Insurance", label: "Finance / Insurance" },
  { value: "Education", label: "Education" },
  { value: "Tourism / Hospitality", label: "Tourism / Hospitality" },
  { value: "General Business", label: "General Business" },
];

const LOCATION_SUGGESTIONS = [
  "Cebu City", "Mandaue City", "Lapu-Lapu City", "Talisay City",
  "Carcar City", "Danao City", "San Fernando, Cebu", "Toledo City, Cebu",
];

const KEYWORD_SUGGESTIONS = [
  "BPO", "Manufacturing", "Logistics", "Retail", "Construction",
  "Food processing", "Tech company", "Call center", "Cement", "Shipping",
];

interface ScrapeResultWithLog extends ScrapeResult {
  log: ScrapeLog;
}

function QueryPreview({
  keyword,
  industry,
  location,
}: {
  keyword: string;
  industry: string;
  location: string;
}) {
  if (!keyword.trim() && !location.trim()) return null;

  const preview = buildSearchQuery({ keyword, industry, location });

  return (
    <div className="flex items-center gap-2 mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
      <Terminal className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
      <span className="text-xs text-slate-500">Query preview:</span>
      <code className="text-xs font-mono text-blue-700 flex-1 truncate">{preview}</code>
    </div>
  );
}

function ScrapeLogPanel({ log }: { log: ScrapeLog }) {
  const { high, medium, low, discarded } = log.locationBreakdown;

  return (
    <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden text-xs">
      <div className="bg-slate-800 px-3 py-2 flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-300 font-mono font-medium">Scrape Log</span>
      </div>
      <div className="bg-slate-900 px-3 py-2 space-y-1 font-mono">
        <LogLine icon="→" color="text-blue-400" label="Generated query" value={`"${log.generatedQuery}"`} />
        <LogLine icon="📍" color="text-green-400" label="Target location" value={log.detectedLocation} />
        <LogLine icon="🔍" color="text-slate-400" label="Total scraped" value={String(log.totalScraped)} />
        <LogLine icon="✓" color="text-green-400" label="After location filter" value={String(log.afterFilter)} />
        <div className="border-t border-slate-700 mt-1 pt-1">
          <span className="text-slate-500">location breakdown: </span>
          <span className="text-green-400">HIGH={high}</span>
          <span className="text-slate-600"> | </span>
          <span className="text-amber-400">MEDIUM={medium}</span>
          <span className="text-slate-600"> | </span>
          <span className="text-red-400">LOW={low}</span>
          <span className="text-slate-600"> | </span>
          <span className="text-slate-500">discarded={discarded}</span>
        </div>
      </div>
    </div>
  );
}

function LogLine({
  icon,
  color,
  label,
  value,
}: {
  icon: string;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={color}>{icon}</span>
      <span className="text-slate-500">{label}:</span>
      <span className="text-slate-200 break-all">{value}</span>
    </div>
  );
}

export default function SearchForm() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResultWithLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim() || !location.trim()) {
      setError("Please enter both a keyword and a location.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setShowLog(false);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          location: location.trim(),
          industry: industry || "General Business",
        }),
      });

      const data: ScrapeResultWithLog & { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Scraping failed. Please try again.");
        return;
      }

      setResult(data);
      setShowLog(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search form */}
      <Card>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Search Parameters</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Keyword */}
          <div>
            <Input
              label="Keyword"
              id="keyword"
              placeholder="e.g. Cement, BPO, Logistics"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              icon={<Search className="h-4 w-4" />}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {KEYWORD_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setKeyword(s)}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <Input
              label="Location"
              id="location"
              placeholder="e.g. Sangat, San Fernando, Cebu"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              icon={<MapPin className="h-4 w-4" />}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {LOCATION_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setLocation(s)}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Industry */}
          <Select
            label="Industry"
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            options={INDUSTRY_OPTIONS}
          />
        </div>

        {/* Live query preview */}
        <QueryPreview keyword={keyword} industry={industry} location={location} />

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mt-4">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={handleSearch}
            loading={loading}
            size="lg"
            className="w-full sm:w-auto"
            disabled={!keyword.trim() || !location.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gathering leads...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Search & Scrape Leads
              </>
            )}
          </Button>
        </div>

        {/* In-progress status */}
        {loading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-blue-800">Scraping in progress...</p>
            </div>
            <div className="space-y-1.5">
              {[
                "Launching Playwright browser...",
                `Sending query: "${buildSearchQuery({ keyword, industry, location })}"`,
                `Targeting location: "${location}"`,
                "Extracting business listings...",
                "Scoring by location relevance...",
                "Qualifying leads...",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <p className="text-xs text-blue-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <Card padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                <span className="text-base font-semibold text-slate-900">
                  {result.count} lead{result.count !== 1 ? "s" : ""} saved
                </span>
              </div>

              {/* Location breakdown pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">Location filter:</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  {result.log.locationBreakdown.high} exact
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  {result.log.locationBreakdown.medium} nearby
                </span>
                {result.log.locationBreakdown.discarded > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    {result.log.locationBreakdown.discarded} discarded
                  </span>
                )}
              </div>

              {/* Toggle log */}
              <button
                onClick={() => setShowLog((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Terminal className="h-3.5 w-3.5" />
                {showLog ? "Hide" : "Show"} log
              </button>
            </div>

            {/* Generated query display */}
            <div className="mt-2 flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
              <Hash className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-500">Used query:</span>
              <code className="text-xs font-mono text-blue-700 flex-1 truncate">
                {result.log.generatedQuery}
              </code>
            </div>

            {showLog && <ScrapeLogPanel log={result.log} />}
          </Card>

          {/* Errors / warnings */}
          {result.errors.length > 0 && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notes:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-600">{e}</p>
              ))}
            </div>
          )}

          {/* Lead list */}
          <Card padding="none">
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-700">
                Results for <span className="text-slate-900">"{result.log.detectedLocation}"</span>
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {result.leads.map((lead: Lead) => (
                <div key={lead.id} className="px-5 py-3">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {lead.company_name}
                      </p>
                      <QualificationBadge qualification={lead.qualification} />
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${
                        expandedId === lead.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {expandedId === lead.id && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-xs text-slate-600">
                      {lead.email && (
                        <span>
                          <strong className="text-slate-500">Email:</strong> {lead.email}
                        </span>
                      )}
                      {lead.phone && (
                        <span>
                          <strong className="text-slate-500">Phone:</strong> {lead.phone}
                        </span>
                      )}
                      {lead.website && (
                        <span className="truncate">
                          <strong className="text-slate-500">Web:</strong> {lead.website}
                        </span>
                      )}
                      {lead.address && (
                        <span className="col-span-full">
                          <strong className="text-slate-500">Address:</strong> {lead.address}
                        </span>
                      )}
                      <span className="col-span-full text-slate-400 italic">
                        {lead.qualification_reason}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
