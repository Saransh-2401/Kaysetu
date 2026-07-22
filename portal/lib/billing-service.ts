/**
 * Billing & subscription — tenant-side API for the Plan & Billing page.
 * Backend: apps.billing (control plane). Checkout is a one-time Razorpay
 * order (mock gateway auto-approves in dev/E2E).
 */
import { apiClient, API_BASE_URL, tokenManager } from "./api-client";

export interface BillingSeats {
  limit: number | null;
  used: number;
}

export interface BillingSubscription {
  package_code: string;
  package_name: string;
  seats: number;
  billing_cycle: "monthly" | "annual";
  status: string;
  current_period_end: string | null;
}

export interface BillingPayment {
  id: number;
  package: string;
  seats: number;
  cycle: string;
  total: string;
  status: "created" | "paid" | "failed";
  paid_at: string | null;
  created_at: string;
  invoice_no: string | null;
}

export interface BillingSummary {
  tenant_status: string;
  trial_ends_at: string | null;
  grace_days: number;
  seats: BillingSeats;
  subscription: BillingSubscription | null;
  payments: BillingPayment[];
}

export interface PublicPackage {
  code: string;
  name: string;
  tagline: string;
  modules: string[];
  is_addon: boolean;
  base_price_monthly: string;
  base_price_annual: string;
  included_users: number;
  per_user_price: string;
}

export interface BillingQuote {
  package_code: string;
  package_name: string;
  seats: number;
  included_users: number;
  extra_users: number;
  billing_cycle: string;
  base: string;
  per_user_unit: string;
  extra_amount: string;
  subtotal: string;
  tax_rate: number;
  tax: string;
  total: string;
}

export interface CheckoutOrder {
  order_id: number;
  gateway: "mock" | "razorpay";
  gateway_order_id: string;
  key_id: string;
  amount_paise: number;
  currency: string;
}

export const billingService = {
  getSummary: () => apiClient.get<BillingSummary>("/t/billing"),

  getPackages: () => apiClient.get<PublicPackage[]>("/public/packages"),

  getQuote: (packageCode: string, seats: number, cycle: string) =>
    apiClient.get<BillingQuote>("/t/billing/quote", {
      package: packageCode,
      seats: String(seats),
      cycle,
    }),

  checkout: (packageCode: string, seats: number, cycle: string) =>
    apiClient.post<CheckoutOrder>("/t/billing/checkout", {
      package_code: packageCode,
      seats,
      cycle,
    }),

  verify: (orderId: number, paymentId: string, signature: string) =>
    apiClient.post("/t/billing/verify", {
      order_id: orderId,
      payment_id: paymentId,
      signature,
    }),

  /** Invoice PDFs need the Authorization header, so plain <a href> won't do. */
  async downloadInvoice(paymentId: number, invoiceNo: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/t/billing/invoice/${paymentId}`, {
      headers: { Authorization: `Bearer ${tokenManager.getAccessToken() ?? ""}` },
    });
    if (!response.ok) throw new Error("Could not download the invoice.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNo}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
