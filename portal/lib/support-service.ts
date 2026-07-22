/**
 * Support tickets — tenant-side API. Tickets live in the control plane so the
 * SuperAdmin team works one queue across every org; internal ops notes are
 * never returned to tenants.
 */
import { apiClient } from "./api-client";

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_customer"
  | "resolved"
  | "closed";

export interface TicketMessage {
  id: number;
  author_kind: "tenant" | "superadmin";
  author_name: string;
  is_internal: boolean;
  body: string;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  ticket_no: string;
  subject: string;
  description: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: TicketStatus;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_reply_by: string;
  message_count: number | null;
  messages?: TicketMessage[];
}

export const TICKET_CATEGORIES = [
  { value: "billing", label: "Billing & Subscription" },
  { value: "technical", label: "Technical Issue" },
  { value: "data", label: "Data / Reports" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
] as const;

export const TICKET_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export const supportService = {
  list: (status?: TicketStatus) =>
    apiClient.get<SupportTicket[]>(
      "/t/support/tickets",
      status ? { status } : undefined
    ),

  get: (id: number) => apiClient.get<SupportTicket>(`/t/support/tickets/${id}`),

  create: (data: {
    subject: string;
    description: string;
    category: string;
    priority: string;
  }) => apiClient.post<SupportTicket>("/t/support/tickets", data),

  reply: (id: number, body: string) =>
    apiClient.post<SupportTicket>(`/t/support/tickets/${id}/reply`, { body }),

  close: (id: number) =>
    apiClient.post<SupportTicket>(`/t/support/tickets/${id}/close`),
};
