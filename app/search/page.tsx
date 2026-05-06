import { Search } from "lucide-react";
import SearchForm from "@/components/search/SearchForm";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Search className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Search Leads</h1>
          <p className="text-sm text-slate-500">
            Gather company leads by keyword, industry, and location
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-900 mb-1">How it works</p>
        <p className="text-sm text-blue-700">
          Enter a keyword (e.g. <strong>BPO</strong>) and location (e.g. <strong>Cebu City</strong>),
          then click Search. The system will scrape public business directories, qualify each lead
          automatically, and save them to the database.
        </p>
      </div>

      <SearchForm />
    </div>
  );
}
