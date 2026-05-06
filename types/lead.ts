export type LeadQualification = "HIGH" | "MEDIUM" | "LOW";
export type LeadStatus = "New" | "Reviewed" | "Ready for Outreach";

export interface Lead {
  id: string;
  company_name: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  address: string | null;
  qualification: LeadQualification;
  qualification_reason: string;
  notes: string | null;
  status: LeadStatus;
  created_at: string;
}

export type LeadInsert = Omit<Lead, "id" | "created_at">;
export type LeadUpdate = Partial<Omit<Lead, "id" | "created_at">>;

export interface LeadFilters {
  search?: string;
  status?: LeadStatus | "all";
  qualification?: LeadQualification | "all";
  industry?: string;
}

export interface PaginatedLeads {
  data: Lead[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ScrapeRequest {
  keyword: string;
  location: string;
  industry: string;
}

export interface ScrapeResult {
  success: boolean;
  count: number;
  leads: Lead[];
  errors: string[];
}
