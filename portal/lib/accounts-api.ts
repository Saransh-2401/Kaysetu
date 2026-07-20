/**
 * Accounts module API service
 * Connects to Django backend at /api/v1/
 */

import { apiClient } from './api-client';

// --- Types ---

export interface SalesOverview {
  overview: {
    outstanding_amount: number;
    total_sales_value: number;
    month_sales_value: number;
    year_sales_value: number;
    pending_orders_value: number;
    pending_orders_count: number;
    sales_trend: { name: string; value: number }[];
  };
}

export interface PurchaseOverview {
  overview: {
    pending_pos_value: number;
    total_purchase_value: number;
    month_purchase_value: number;
    pending_pos_count: number;
    pending_material_requests: number;
  };
}

export interface CashFlowData {
  period: { from_date: string; to_date: string };
  operating_activities: {
    cash_from_customers: number;
    cash_to_suppliers: number;
    net_cash_from_operations: number;
  };
}

export interface ProfitLossData {
  period: { from_date: string; to_date: string };
  income: {
    sales_revenue: number;
    other_income: number;
    total_income: number;
  };
  expenses: {
    cost_of_goods_sold: number;
    operating_expenses: number;
    total_expenses: number;
  };
  profit: {
    gross_profit: number;
    net_profit: number;
    net_profit_margin: number;
  };
}

export interface BalanceSheetData {
  as_of_date: string;
  assets: {
    accounts_receivable: number;
    cash_and_bank: number;
    total_assets: number;
  };
  liabilities: {
    accounts_payable: number;
    total_liabilities: number;
  };
  equity: {
    retained_earnings: number;
    total_equity: number;
  };
  balance_check: { assets: number; liabilities_plus_equity: number; balanced: boolean };
}

export interface ManualInvoiceResult {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  grand_total: string;
  advance_paid: string;
  status: string; // 'unpaid' | 'partially_paid' | 'paid'
}

export interface SalesInvoiceResult {
  id: number;
  invoice_number: string;
  customer?: { id: number; customer_name?: string } | number;
  customer_name?: string;
  invoice_date: string;
  due_date?: string;
  total: string;
  outstanding_amount?: string;
  payment_status: string;
}

export interface PurchaseInvoiceResult {
  id: number;
  invoice_number: string;
  supplier?: { id: number; supplier_name?: string } | number;
  supplier_name?: string;
  invoice_date: string;
  due_date?: string;
  total: string;
  outstanding_amount?: string;
  payment_status: string;
}

export interface StockRequestInvoiceResult {
  id: number;
  invoice_number: string;
  stock_request: number;
  request_number: string;
  distributor_name: string;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: string;
  payment_status: string; // 'unpaid' | 'invoiced' | 'paid' | 'overdue'
  payment_date?: string | null;
  payment_reference?: string;
  notes?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

export interface Account {
  id: number;
  account_name: string;
  account_number: string;
  account_type: string;
}

export interface GLLine {
  date: string | null;
  ref: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountLedger {
  account: { id: number; name: string };
  currency: string;
  opening_balance: number;
  lines: GLLine[];
  closing_balance: number;
}

// --- Helpers ---

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Returns the fiscal year start month (1–12) stored in localStorage.
 * Falls back to 4 (April) — the Indian standard.
 */
export function getFiscalMonthStart(): number {
  if (typeof window === 'undefined') return 4;
  const stored = localStorage.getItem('fiscalMonthStart');
  const parsed = stored ? parseInt(stored, 10) : NaN;
  return isNaN(parsed) || parsed < 1 || parsed > 12 ? 4 : parsed;
}

/** Current financial year based on the configured fiscal start month */
export function getFYDates(): { from_date: string; to_date: string } {
  const fms = getFiscalMonthStart();
  const fmsJS = fms - 1; // convert to JS 0-indexed month
  const today = new Date();
  const fyStartYear = today.getMonth() >= fmsJS ? today.getFullYear() : today.getFullYear() - 1;
  const fyStart = new Date(fyStartYear, fmsJS, 1);
  const fyEnd = new Date(fyStartYear + 1, fmsJS, 0); // day 0 = last day of previous month
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return {
    from_date: fmt(fyStart),
    to_date: fmt(new Date(Math.min(fyEnd.getTime(), today.getTime()))),
  };
}

/** Previous financial year based on the configured fiscal start month */
export function getLastFYDates(): { from_date: string; to_date: string } {
  const fms = getFiscalMonthStart();
  const fmsJS = fms - 1;
  const today = new Date();
  const fyStartYear = (today.getMonth() >= fmsJS ? today.getFullYear() : today.getFullYear() - 1) - 1;
  const fyStart = new Date(fyStartYear, fmsJS, 1);
  const fyEnd = new Date(fyStartYear + 1, fmsJS, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from_date: fmt(fyStart), to_date: fmt(fyEnd) };
}

/** Current quarter */
export function getQuarterDates(): { from_date: string; to_date: string } {
  const today = new Date();
  const qMonth = today.getMonth() - (today.getMonth() % 3);
  const start = new Date(today.getFullYear(), qMonth, 1);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from_date: fmt(start), to_date: fmt(today) };
}

/** Last N months, each as { from_date, to_date, label } */
export function getMonthRanges(count = 6): { from_date: string; to_date: string; label: string }[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (count - 1 - i), 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const fmt = (dt: Date) => dt.toISOString().split('T')[0];
    return {
      from_date: fmt(start),
      to_date: fmt(new Date(Math.min(end.getTime(), today.getTime()))),
      label: start.toLocaleString('default', { month: 'short' }),
    };
  });
}

/** Extract entity name from nested or flat field */
export function getEntityName(
  field: { id: number; customer_name?: string; supplier_name?: string } | number | undefined,
  flatName?: string,
  fallback = 'Unknown'
): string {
  if (flatName) return flatName;
  if (!field) return fallback;
  if (typeof field === 'object') {
    return field.customer_name || field.supplier_name || fallback;
  }
  return fallback;
}

/** Map payment_status to display label (covers all invoice types) */
export function mapStatus(status: string): 'Paid' | 'Partial' | 'Pending' | 'Overdue' {
  switch (status) {
    case 'paid': return 'Paid';
    case 'partially_paid': return 'Partial';
    case 'unpaid': return 'Pending';
    case 'invoiced': return 'Pending';  // StockRequestInvoice: invoiced = pending payment
    case 'overdue': return 'Overdue';
    default: return 'Pending';
  }
}

// --- API ---

export const accountsApi = {
  getSalesOverview: (range = 'This Month') =>
    apiClient.get<SalesOverview>('/analytics/sales/overview/', { range }),

  getPurchaseOverview: () =>
    apiClient.get<PurchaseOverview>('/analytics/purchase/overview/'),

  // Financial statements — computed from the BOOKS general ledger.
  getCashFlow: (params: Record<string, string>) =>
    apiClient.get<CashFlowData>('/t/books/reports/cash-flow/', params),

  getProfitLoss: (params: Record<string, string>) =>
    apiClient.get<ProfitLossData>('/t/books/reports/profit-loss/', params),

  getBalanceSheet: (params: Record<string, string>) =>
    apiClient.get<BalanceSheetData>('/t/books/reports/balance-sheet/', params),

  getSalesInvoices: (params: Record<string, string>) =>
    apiClient.get<PaginatedResponse<SalesInvoiceResult>>('/sales/invoices/', params),

  // Supplier bills — PURCH module (serves invoice_number/supplier_name/total/
  // outstanding_amount/payment_status, the shape this screen reads).
  getPurchaseInvoices: (params: Record<string, string>) =>
    apiClient.get<PaginatedResponse<PurchaseInvoiceResult>>('/t/purchase/bills/', params),

  getStockRequestInvoices: (params: Record<string, string>) =>
    apiClient.get<PaginatedResponse<StockRequestInvoiceResult>>('/t/dist/invoices/', params),

  getManualInvoices: (params: Record<string, string>) =>
    apiClient.get<PaginatedResponse<ManualInvoiceResult>>('/sales/manual-invoices/', params),

  markStockInvoicePaid: (id: number, data: { payment_reference: string; payment_date: string }) =>
    apiClient.post<StockRequestInvoiceResult>(`/t/dist/invoices/${id}/mark_paid/`, data),

  // Chart of Accounts + general ledger — BOOKS module.
  getAccounts: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Account>>('/t/books/accounts/', params),

  getAccountLedger: (id: number, params?: Record<string, string>) =>
    apiClient.get<AccountLedger>(`/t/books/accounts/${id}/ledger/`, params),

};
