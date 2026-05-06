"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import QualificationBadge from "@/components/leads/QualificationBadge";
import type { Lead, ScrapeResult } from "@/types/lead";

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
  "Cebu City", "Mandaue City", "Lapu-Lapu City",
  "Talisay City", "Carcar City", "Danao City",
];

const KEYWORD_SUGGESTIONS = [
  "BPO", "Manufacturing", "Logistics", "Retail", "Construction",
  "Food processing", "Tech company", "Call center",
];

export default function SearchForm() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!keyword.trim() || !location.trim()) {
      setError("Please enter both a keyword and a location.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

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

      const data: ScrapeResult & { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Scraping failed. Please try again.");
        return;
      }

      setResult(data);
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <Input
              label="Keyword"
              id="keyword"
              placeholder="e.g. BPO, Manufacturing"
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

          <div>
            <Input
              label="Location"
              id="location"
              placeholder="e.g. Cebu City, Mandaue"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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

          <Select
            label="Industry"
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            options={INDUSTRY_OPTIONS}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

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

        {loading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <p className="text-sm font-medium text-blue-800">Scraping in progress...</p>
            </div>
            <div className="space-y-1.5">
              {["Launching browser...", `Searching for "${keyword} ${location}"...`, "Extracting business data...", "Qualifying leads..."].map((step, i) => (
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
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-base font-semibold text-slate-900">
                {result.count} leads gathered
              </span>
            </div>
            <span className="text-sm text-slate-500">
              Saved to database automatically
            </span>
          </div>

          {result.errors.length > 0 && (
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs font-medium text-amber-700 mb-1">Notes:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-600">{e}</p>
              ))}
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {result.leads.map((lead: Lead) => (
              <div key={lead.id} className="px-5 py-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{lead.company_name}</p>
                    <QualificationBadge qualification={lead.qualification} />
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${expandedId === lead.id ? "rotate-180" : ""}`}
                  />
                </div>

                {expandedId === lead.id && (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-600">
                    {lead.email && <span><strong>Email:</strong> {lead.email}</span>}
                    {lead.phone && <span><strong>Phone:</strong> {lead.phone}</span>}
                    {lead.website && <span><strong>Web:</strong> {lead.website}</span>}
                    {lead.address && <span className="col-span-2"><strong>Address:</strong> {lead.address}</span>}
                    <span className="col-span-full text-slate-400 italic">{lead.qualification_reason}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
