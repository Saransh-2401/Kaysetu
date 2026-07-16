/**
 * Travel Allowance API Service
 * Claims workflow: submit → manager approve/reject → finance approve/reject → payment.
 * Backend: apps/travel_allowance (mounted at /travel-allowance/).
 */

import { apiClient } from "./api-client";

// ============ Types ============

export type AllowanceStatus =
  | "submitted"
  | "manager_review"
  | "manager_approved"
  | "manager_rejected"
  | "finance_review"
  | "finance_approved"
  | "finance_rejected"
  | "processing_payment"
  | "paid";

export interface Trip {
  id: number;
  agent: number;
  agent_name?: string;
  visit?: number | null;
  customer_name?: string | null;
  date: string;
  start_location?: Record<string, unknown>;
  end_location?: Record<string, unknown>;
  distance_km: string;
  transport_mode: string;
  is_claimed: boolean;
  created_at?: string;
}

export interface AllowanceDocument {
  id: number;
  request: number;
  file_url: string;
  file_name?: string;
  doc_type: string;
  doc_type_display?: string;
  created_at?: string;
}

export interface AllowanceApproval {
  id: number;
  approver?: number;
  approver_name?: string;
  role: "manager" | "finance";
  role_display?: string;
  status: "approved" | "rejected";
  comment?: string;
  created_at?: string;
}

export interface AllowancePayment {
  id: number;
  amount: string;
  status: string;
  payment_mode?: string;
  transaction_id?: string;
  reference?: string;
  proof_url?: string;
  processed_at?: string | null;
}

export interface StatusHistoryEntry {
  status: string;
  user: string;
  timestamp: string;
  notes?: string;
}

export interface AllowanceRequest {
  id: number;
  request_no: string;
  agent: number;
  agent_name?: string;
  request_type: string;
  request_type_display?: string;
  request_status: AllowanceStatus;
  request_status_display?: string;
  period_start: string;
  period_end: string;
  total_distance_km: string;
  system_amount: string;
  claimed_amount: string;
  approved_amount?: string | null;
  payable_amount?: string;
  transport_mode?: string;
  notes?: string;
  is_flagged: boolean;
  flag_reason?: string;
  status_history?: StatusHistoryEntry[];
  trips?: { id: number; trip: Trip }[];
  documents?: AllowanceDocument[];
  approvals?: AllowanceApproval[];
  payment?: AllowancePayment | null;
  created_at?: string;
  updated_at?: string;
}

export interface PolicyConfig {
  id: number;
  city: string;
  vehicle_type: string;
  vehicle_type_display?: string;
  rate_per_km: string;
  max_daily_limit: string;
  max_monthly_limit: string;
  is_active: boolean;
}

export interface AgentBankDetail {
  id: number;
  agent: number;
  agent_name?: string;
  account_holder_name?: string;
  account_number?: string;
  masked_account_number?: string;
  ifsc_code?: string;
  bank_name?: string;
  upi_id?: string;
}

export interface TAAnalytics {
  summary: {
    total_requests: number;
    total_claimed: number;
    total_approved: number;
    total_paid: number;
    pending_amount: number;
  };
  approval_rate: number | null;
  avg_processing_days: number | null;
  transport_breakdown: { transport_mode: string; count: number }[];
  payment_rollups: { this_month: number; this_quarter: number; this_year: number };
}

export interface TANotificationPrefs {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  deadline_reminders: boolean;
  unclaimed_reminders: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

interface Paginated<T> {
  count: number;
  results: T[];
}

const BASE = "/travel-allowance";

function unwrap<T>(res: Paginated<T> | T[]): T[] {
  if (Array.isArray(res)) return res;
  return res?.results ?? [];
}

// ============ Service ============

export const travelAllowanceService = {
  // ── Requests ──────────────────────────────────────────────────────────────
  async listRequests(params: Record<string, string> = {}): Promise<AllowanceRequest[]> {
    const res = await apiClient.get<Paginated<AllowanceRequest> | AllowanceRequest[]>(
      `${BASE}/requests/`,
      { page_size: "500", ...params }
    );
    return unwrap(res);
  },

  async getRequest(id: number): Promise<AllowanceRequest> {
    return apiClient.get<AllowanceRequest>(`${BASE}/requests/${id}/`);
  },

  async createRequest(payload: {
    request_type?: string;
    trip_ids: number[];
    claimed_amount?: string;
    notes?: string;
  }): Promise<AllowanceRequest> {
    return apiClient.post<AllowanceRequest>(`${BASE}/requests/`, payload);
  },

  async managerApprove(id: number, comment = ""): Promise<AllowanceRequest> {
    return apiClient.post<AllowanceRequest>(`${BASE}/requests/${id}/manager_approve/`, { comment });
  },

  async managerReject(id: number, reason: string): Promise<AllowanceRequest> {
    return apiClient.post<AllowanceRequest>(`${BASE}/requests/${id}/manager_reject/`, { reason });
  },

  async financeApprove(id: number, approved_amount?: string, comment = ""): Promise<AllowanceRequest> {
    return apiClient.post<AllowanceRequest>(`${BASE}/requests/${id}/finance_approve/`, {
      approved_amount,
      comment,
    });
  },

  async financeReject(id: number, reason: string): Promise<AllowanceRequest> {
    return apiClient.post<AllowanceRequest>(`${BASE}/requests/${id}/finance_reject/`, { reason });
  },

  async recordPayment(
    id: number,
    payload: { amount?: string; payment_mode?: string; transaction_id?: string; reference?: string; proof_url?: string }
  ): Promise<AllowanceRequest> {
    return apiClient.post<AllowanceRequest>(`${BASE}/requests/${id}/record_payment/`, payload);
  },

  async recalculate(id: number): Promise<AllowanceRequest> {
    return apiClient.post<AllowanceRequest>(`${BASE}/requests/${id}/recalculate/`, {});
  },

  async uploadDocument(id: number, file: File, docType: string): Promise<AllowanceDocument> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    return apiClient.post<AllowanceDocument>(`${BASE}/requests/${id}/upload_document/`, fd);
  },

  async getAnalytics(params: Record<string, string> = {}): Promise<TAAnalytics> {
    return apiClient.get<TAAnalytics>(`${BASE}/requests/analytics/`, params);
  },

  // ── Notification preferences (current user) ───────────────────────────────
  async getNotificationPrefs(): Promise<TANotificationPrefs> {
    return apiClient.get<TANotificationPrefs>(`${BASE}/notification-preferences/`);
  },

  async updateNotificationPrefs(p: Partial<TANotificationPrefs>): Promise<TANotificationPrefs> {
    return apiClient.put<TANotificationPrefs>(`${BASE}/notification-preferences/`, p);
  },

  // ── Trips ─────────────────────────────────────────────────────────────────
  async listTrips(params: Record<string, string> = {}): Promise<Trip[]> {
    const res = await apiClient.get<Paginated<Trip> | Trip[]>(`${BASE}/trips/`, {
      page_size: "500",
      ...params,
    });
    return unwrap(res);
  },

  // ── Policies ──────────────────────────────────────────────────────────────
  async listPolicies(): Promise<PolicyConfig[]> {
    const res = await apiClient.get<Paginated<PolicyConfig> | PolicyConfig[]>(`${BASE}/policies/`, {
      page_size: "200",
    });
    return unwrap(res);
  },

  async createPolicy(payload: Partial<PolicyConfig>): Promise<PolicyConfig> {
    return apiClient.post<PolicyConfig>(`${BASE}/policies/`, payload);
  },

  async updatePolicy(id: number, payload: Partial<PolicyConfig>): Promise<PolicyConfig> {
    return apiClient.patch<PolicyConfig>(`${BASE}/policies/${id}/`, payload);
  },

  async deletePolicy(id: number): Promise<void> {
    return apiClient.delete<void>(`${BASE}/policies/${id}/`);
  },

  // ── Bank details ──────────────────────────────────────────────────────────
  async listBankDetails(): Promise<AgentBankDetail[]> {
    const res = await apiClient.get<Paginated<AgentBankDetail> | AgentBankDetail[]>(
      `${BASE}/bank-details/`,
      { page_size: "500" }
    );
    return unwrap(res);
  },

  async saveBankDetail(payload: Partial<AgentBankDetail>): Promise<AgentBankDetail> {
    if (payload.id) return apiClient.patch<AgentBankDetail>(`${BASE}/bank-details/${payload.id}/`, payload);
    return apiClient.post<AgentBankDetail>(`${BASE}/bank-details/`, payload);
  },

  // ── Admin: set per-day home/office basis ──────────────────────────────────
  async setBasis(agent: number, date: string, basis: "home" | "office" | ""): Promise<void> {
    return apiClient.post<void>(`${BASE}/set-basis/`, { agent, date, basis });
  },
};

// ── Display helpers ──────────────────────────────────────────────────────────

export const ALLOWANCE_STATUS_LABELS: Record<AllowanceStatus, string> = {
  submitted: "Submitted",
  manager_review: "Manager Review",
  manager_approved: "Manager Approved",
  manager_rejected: "Manager Rejected",
  finance_review: "Finance Review",
  finance_approved: "Finance Approved",
  finance_rejected: "Finance Rejected",
  processing_payment: "Processing Payment",
  paid: "Paid",
};

export function allowanceStatusColor(
  status: string
): "default" | "warning" | "info" | "success" | "error" {
  switch (status) {
    case "submitted":
    case "manager_review":
    case "finance_review":
    case "processing_payment":
      return "warning";
    case "manager_approved":
    case "finance_approved":
      return "info";
    case "paid":
      return "success";
    case "manager_rejected":
    case "finance_rejected":
      return "error";
    default:
      return "default";
  }
}
