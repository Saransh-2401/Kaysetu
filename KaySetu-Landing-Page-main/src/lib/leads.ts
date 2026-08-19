/**
 * Lead capture - posts marketing enquiries to the KaySetu API.
 *
 * Everything submitted on this site (contact form, footer demo request) lands
 * in the ops console's Leads queue. Before this existed the forms only *looked*
 * like they worked: they showed a success state and discarded the data.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.kaysetu.in/api";

export type LeadSource =
  | "contact_form"
  | "footer_demo"
  | "instant_demo"
  | "pricing"
  | "other";

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source: LeadSource;
  attachment?: File | null;
  /** Honeypot - must stay empty; real users never see the field. */
  website?: string;
}

/** UTM + page context, so spend can be traced to pipeline later. */
function attribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {
    page_url: window.location.href,
    referrer: document.referrer || "",
  };
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

export class LeadError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.fields = fields;
  }
}

export async function submitLead(input: LeadInput): Promise<void> {
  const body = new FormData();
  body.append("name", input.name.trim());
  body.append("email", input.email.trim());
  body.append("source", input.source);
  if (input.phone) body.append("phone", input.phone.trim());
  if (input.company) body.append("company", input.company.trim());
  if (input.message) body.append("message", input.message.trim());
  if (input.website) body.append("website", input.website);
  if (input.attachment) body.append("attachment", input.attachment);
  for (const [key, value] of Object.entries(attribution())) body.append(key, value);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/public/leads`, { method: "POST", body });
  } catch {
    // Network/DNS/CORS failure - never pretend this succeeded.
    throw new LeadError(
      "We couldn't reach our servers. Please check your connection or email us directly."
    );
  }

  if (response.status === 429) {
    throw new LeadError("Too many submissions from this network. Please try again later.");
  }
  if (!response.ok) {
    let fields: Record<string, string> = {};
    try {
      fields = await response.json();
    } catch {
      /* non-JSON error body */
    }
    const first = Object.values(fields)[0];
    throw new LeadError(
      typeof first === "string" ? first : "Something went wrong. Please try again.",
      fields as Record<string, string>
    );
  }
}
