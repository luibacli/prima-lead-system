/**
 * AI service layer — architecture prepared for future OpenAI integration.
 * All methods return stub responses until AI calls are activated.
 */

export interface LeadEnrichmentResult {
  suggestedIndustry: string | null;
  potentialEmployeeCount: string | null;
  partnershipFit: string | null;
  outreachNote: string | null;
}

// Placeholder: will call OpenAI when activated
export async function enrichLeadWithAI(
  companyName: string,
  website: string | null
): Promise<LeadEnrichmentResult> {
  // TODO: Activate when AI is ready
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  // const response = await openai.chat.completions.create({ ... })
  return {
    suggestedIndustry: null,
    potentialEmployeeCount: null,
    partnershipFit: null,
    outreachNote: null,
  };
}

// Placeholder: generate personalized outreach copy
export async function generateOutreachDraft(lead: {
  company_name: string;
  industry: string | null;
  address: string | null;
}): Promise<string> {
  // TODO: Activate when AI is ready
  return `Hi, I'm reaching out from PrimaWell Medical Clinic regarding our YAKAP employee wellness program for ${lead.company_name}.`;
}
