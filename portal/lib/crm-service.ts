/**
 * CRM API Service
 * Handles leads, opportunities, customers, quotations
 */

import { apiClient } from './api-client';

// ============ Types ============

export interface Lead {
    id: number;
    name: string;
    company_name: string;
    email: string;
    phone: string;
    job_title?: string;
    lead_type: string;
    source: string;
    status: string;
    industry?: string;
    assigned_to?: number;
    assigned_to_name?: string;
    created_by_name?: string;
    notes?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    created_at: string;
}



export interface Customer {
    id: number;
    customer_code: string;
    customer_name: string;
    shop_name?: string;
    customer_group: string;
    email: string;
    phone: string;
    tax_id?: string;
    pan_number?: string;
    aadhaar_number?: string;
    credit_limit: number;
    total_orders?: number;
    total_revenue?: number;
    payment_terms: string;
    is_active: boolean;
    status: string;
    assigned_agent?: number;
    assigned_agent_name?: string;
    distributor?: number;
    distributor_name?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
    address?: any;
    formatted_address?: string;
    shop_image?: string;
    shop_images?: string[];
    owner_image?: string;
    gst_certificate?: string;
    pan_card?: string;
    aadhaar_front?: string;
    aadhaar_back?: string;
    created_at: string;
    created_by?: string;
    updated_at?: string;
}

export interface LedgerLine {
    date: string | null;
    ref: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export interface CustomerLedger {
    customer: { id: number; name: string };
    currency: string;
    opening_balance: number;
    lines: LedgerLine[];
    closing_balance: number;
}

export interface Quotation {
    id: number;
    quotation_number: string;
    customer: number;
    customer_name?: string;
    quotation_date: string;
    valid_until: string;
    currency: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    status: string;
    items?: QuotationItem[];
}

export interface QuotationItem {
    id?: number;
    item: number;
    item_name?: string;
    quantity: number;
    rate: number;
    amount: number;
    tax_amount: number;
}

// ============ Service ============

export const crmService = {
    // ===== Leads =====
    async getLeads(params?: Record<string, string>) {
        return apiClient.get<{ results: Lead[]; count: number }>('/crm/leads/', params);
    },

    async getLead(id: number) {
        return apiClient.get<Lead>(`/crm/leads/${id}/`);
    },

    async createLead(data: Partial<Lead>) {
        return apiClient.post<Lead>('/crm/leads/', data);
    },

    async updateLead(id: number, data: Partial<Lead>) {
        return apiClient.patch<Lead>(`/crm/leads/${id}/`, data);
    },

    async deleteLead(id: number) {
        return apiClient.delete(`/crm/leads/${id}/`);
    },





    // ===== Customers =====
    async getCustomers(params?: Record<string, string>) {
        return apiClient.get<{ results: Customer[]; count: number }>('/crm/customers/', params);
    },

    async getCustomer(id: number) {
        return apiClient.get<Customer>(`/crm/customers/${id}/`);
    },

    async getCustomerDetail(id: number, params?: Record<string, string>) {
        return apiClient.get<any>(`/crm/customers/${id}/detail/`, params);
    },

    async getCustomerLedger(id: number, params?: Record<string, string>) {
        return apiClient.get<CustomerLedger>(`/crm/customers/${id}/ledger/`, params);
    },

    async createCustomer(data: Partial<Customer>) {
        return apiClient.post<Customer>('/crm/customers/', data);
    },

    // Append a new venue/shop image (admin/SM). Backend keeps `keptImages` and appends the new file.
    async addCustomerShopImage(id: number, file: File, keptImages: string[]) {
        const fd = new FormData();
        fd.append("image_shop_0", file);
        fd.append("shop_images", JSON.stringify(keptImages));
        return apiClient.patch<Customer>(`/crm/customers/${id}/`, fd);
    },

    async updateCustomer(id: number, data: Partial<Customer>) {
        return apiClient.patch<Customer>(`/crm/customers/${id}/`, data);
    },

    // ===== Quotations =====
    async getQuotations(params?: Record<string, string>) {
        return apiClient.get<{ results: Quotation[] }>('/crm/quotations/', params);
    },

    async getQuotation(id: number) {
        return apiClient.get<Quotation>(`/crm/quotations/${id}/`);
    },

    async createQuotation(data: Partial<Quotation> & { items: QuotationItem[] }) {
        return apiClient.post<Quotation>('/crm/quotations/', data);
    },

    async markQuotationWon(id: number) {
        return apiClient.post(`/crm/quotations/${id}/mark_won/`, {});
    },

    async markQuotationLost(id: number) {
        return apiClient.post(`/crm/quotations/${id}/mark_lost/`, {});
    },
};
