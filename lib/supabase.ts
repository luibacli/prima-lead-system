import { createClient } from "@supabase/supabase-js";
import type { Lead, LeadInsert, LeadUpdate, LeadFilters, PaginatedLeads } from "@/types/lead";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

export function getServiceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function getLeads(
  filters: LeadFilters = {},
  page = 1,
  pageSize = 20
): Promise<PaginatedLeads> {
  const client = getServiceClient();
  let query = client.from("leads").select("*", { count: "exact" });

  if (filters.search) {
    query = query.or(
      `company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,address.ilike.%${filters.search}%`
    );
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.qualification && filters.qualification !== "all") {
    query = query.eq("qualification", filters.qualification);
  }
  if (filters.industry) {
    query = query.ilike("industry", `%${filters.industry}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: (data as Lead[]) ?? [],
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Lead;
}

export async function createLead(lead: LeadInsert): Promise<Lead> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("leads")
    .insert(lead)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function createLeads(leads: LeadInsert[]): Promise<Lead[]> {
  const client = getServiceClient();
  const { data, error } = await client.from("leads").insert(leads).select();
  if (error) throw error;
  return (data as Lead[]) ?? [];
}

export async function updateLead(id: string, update: LeadUpdate): Promise<Lead> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("leads")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function deleteLead(id: string): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function getLeadStats() {
  const client = getServiceClient();
  const { data, error } = await client.from("leads").select("qualification, status");
  if (error) throw error;

  const leads = data ?? [];
  return {
    total: leads.length,
    high: leads.filter((l) => l.qualification === "HIGH").length,
    medium: leads.filter((l) => l.qualification === "MEDIUM").length,
    low: leads.filter((l) => l.qualification === "LOW").length,
    new: leads.filter((l) => l.status === "New").length,
    reviewed: leads.filter((l) => l.status === "Reviewed").length,
    ready: leads.filter((l) => l.status === "Ready for Outreach").length,
  };
}

export async function getAllLeadsForExport(): Promise<Lead[]> {
  const client = getServiceClient();
  const { data, error } = await client
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Lead[]) ?? [];
}
