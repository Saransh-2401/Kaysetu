/**
 * Sales API Service
 * Handles sales orders, invoices, payments, deliveries
 */

import { apiClient } from './api-client';

// ============ Types ============

export interface SalesOrder {
    id: number;
    order_number: string;
    customer: number;
    customer_name?: string;
    order_date: string;
    advance_amount?: number;
    currency: string;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    total: number;
    status: string;
    fulfillment_status: string;
    payment_status: string;
    distributor?: number;
    distributor_name?: string;
    assigned_agent?: number;
    assigned_agent_name?: string;
    sales_manager_name?: string;
    sales_manager_id?: number;
    is_overdue?: boolean;
    invoice_id?: number;
    billing_address?: any;
    shipping_address?: any;
    approved_by_name?: string;
    approved_at?: string;
    modified_by_name?: string;
    has_invoice?: boolean;
    logs?: SalesOrderLog[];
    items?: SalesOrderItem[];
}

export interface SalesOrderLog {
    id: number;
    from_status: string;
    to_status: string;
    changed_by_name: string;
    changed_at: string;
    notes: string;
}

export interface SalesOrderItem {
    id?: number;
    item: number;
    item_name?: string;
    item_code?: string;
    product?: number;
    product_name?: string;
    hsn_code?: string;
    price_includes_tax?: boolean;
    quantity: number;
    rate: number;
    amount: number;
    total_amount?: number;
    tax_percentage?: number;
    product_tax_rate?: number;
    warehouse?: number;
}

export interface SalesInvoiceItem {
    id?: number;
    product?: number;
    product_name?: string;
    item?: number;
    item_name?: string;
    item_code?: string;
    quantity: number;
    rate: number;
    amount: number;
    tax_amount?: number;
    cgst_rate?: number;
    sgst_rate?: number;
    igst_rate?: number;
    cess_rate?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    igst_amount?: number;
    cess_amount?: number;
    taxable_value?: number;
    total_price?: number;
    hsn_code?: string;
}

export interface SalesInvoice {
    id: number;
    invoice_number: string;
    customer: number;
    customer_name?: string;
    sales_order?: number;
    invoice_date: string;
    due_date: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    outstanding_amount: number;
    paid_amount: number;
    payment_status: string;
    status: string;
    items?: SalesInvoiceItem[];
    is_tax_inclusive?: boolean;
    tax_input_mode?: 'percentage' | 'rupee';
    discount_type?: 'amount' | 'percentage';
    discount_value?: number;
    discount_amount?: number;
    notes?: string;
}

export interface PaymentEntry {
    id: number;
    payment_number: string;
    sales_invoice?: number;
    sales_order?: number;
    invoice_number?: string;
    payment_date: string;
    amount: number;
    mode: string;
    reference_no?: string;
    status: string;
}

export interface ManualInvoiceItem {
    id?: number;
    item_name: string;
    hsn_code: string;
    quantity: number;
    unit_price: number;
    tax_percentage: number;
    taxable_amount: number;
    tax_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total_amount: number;

    // Frontend compatibility
    taxable_value?: number;
    total?: number;
}

export interface ManualInvoice {
    id: number;
    invoice_number: string;
    customer_name: string;
    customer_address?: string;
    customer_gstin?: string;
    invoice_date: string;
    due_date: string;
    tax_type: 'cgst_sgst' | 'igst';
    is_tax_inclusive: boolean;
    subtotal: number;
    tax_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    discount_amount: number;
    advance_paid: number;
    round_off: number;
    grand_total: number;
    notes?: string;
    status: string;
    created_by_name?: string;
    payment_date?: string;
    payment_reference?: string;
    items?: ManualInvoiceItem[];
}

// ============ Service ============

export const salesService = {
    // ===== Sales Orders =====
    async getSalesOrders(params?: Record<string, string>) {
        return apiClient.get<{ results: SalesOrder[] }>('/sales/orders/', params);
    },

    async getSalesOrder(id: number) {
        return apiClient.get<SalesOrder>(`/sales/orders/${id}/`);
    },

    async createSalesOrder(data: Partial<SalesOrder> & { items: SalesOrderItem[] }) {
        return apiClient.post<SalesOrder>('/sales/orders/', data);
    },

    async updateSalesOrder(id: number, data: Partial<SalesOrder>) {
        return apiClient.patch<SalesOrder>(`/sales/orders/${id}/`, data);
    },

    async submitSalesOrder(id: number) {
        return apiClient.post(`/sales/orders/${id}/submit/`, {});
    },

    async approveSalesOrder(id: number, notes?: string) {
        return apiClient.post(`/sales/orders/${id}/confirm/`, { notes });
    },

    async getStockDetails(id: number) {
        return apiClient.get<any[]>(`/sales/orders/${id}/stock_details/`);
    },

    async updateOrderItems(id: number, data: { items: any[] }) {
        return apiClient.post(`/sales/orders/${id}/update_items/`, data);
    },

    async updateAndApproveOrder(id: number, data: { items: any[], notes: string }) {
        return apiClient.post(`/sales/orders/${id}/update_and_approve/`, data);
    },

    async rejectSalesOrder(id: number, notes?: string) {
        return apiClient.post(`/sales/orders/${id}/reject/`, { notes });
    },

    async packSalesOrder(id: number, notes?: string) {
        return apiClient.post(`/sales/orders/${id}/pack/`, { notes });
    },

    async dispatchSalesOrder(id: number, notes?: string) {
        return apiClient.post(`/sales/orders/${id}/mark_dispatched/`, { notes });
    },

    async deliverSalesOrder(id: number, notes?: string) {
        return apiClient.post(`/sales/orders/${id}/deliver/`, { notes });
    },

    async markSalesOrderPaid(id: number, reference: string, amount?: number, mode: string = 'bank_transfer') {
        return apiClient.post(`/sales/orders/${id}/mark_paid/`, { reference, amount, mode });
    },

    async generateOrderInvoice(id: number, data?: any) {
        // data can contain detailed invoice fields (items, tax, etc.)
        return apiClient.post<{ message: string; invoice_id: number }>(`/sales/orders/${id}/generate_invoice/`, data || {});
    },

    async getBackorderedOrders() {
        return apiClient.get<SalesOrder[]>('/sales/orders/backordered/');
    },

    // ===== Invoices =====
    async getSalesInvoices(params?: Record<string, string>) {
        return apiClient.get<{ results: SalesInvoice[], count: number }>('/sales/invoices/', params);
    },

    async getSalesInvoice(id: number) {
        return apiClient.get<SalesInvoice>(`/sales/invoices/${id}/`);
    },

    async createSalesInvoice(data: Partial<SalesInvoice>) {
        return apiClient.post<SalesInvoice>('/sales/invoices/', data);
    },

    async submitSalesInvoice(id: number) {
        return apiClient.post(`/sales/invoices/${id}/submit/`, {});
    },

    async approveSalesInvoice(id: number) {
        return apiClient.post(`/sales/invoices/${id}/approve/`, {});
    },

    async deleteSalesInvoice(id: number) {
        return apiClient.delete(`/sales/invoices/${id}/`);
    },

    async downloadInvoicePDF(invoiceId: number) {
        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const token = typeof window !== 'undefined' ? localStorage.getItem('salexa_access_token') : null;

            const response = await fetch(`${apiBaseUrl}/sales/invoices/${invoiceId}/download_pdf/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to download PDF (Status: ${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Invoice-${invoiceId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("PDF Download error:", error);
            throw error;
        }
    },

    // ===== Payments =====
    async getPayments(params?: Record<string, string>) {
        return apiClient.get<{ results: PaymentEntry[] }>('/sales/payments/', params);
    },

    async createPayment(data: Partial<PaymentEntry>) {
        return apiClient.post<PaymentEntry>('/sales/payments/', data);
    },

    async markPaymentCleared(id: number) {
        return apiClient.post(`/sales/payments/${id}/mark_cleared/`, {});
    },

    // ===== Manual Invoices =====
    async getManualInvoices(params?: Record<string, string>) {
        return apiClient.get<{ results: ManualInvoice[], count: number }>('/sales/manual-invoices/', params);
    },

    async getManualInvoice(id: number) {
        return apiClient.get<ManualInvoice>(`/sales/manual-invoices/${id}/`);
    },

    async createManualInvoice(data: Partial<ManualInvoice>) {
        return apiClient.post<ManualInvoice>('/sales/manual-invoices/', data);
    },

    async updateManualInvoice(id: number, data: Partial<ManualInvoice>) {
        return apiClient.patch<ManualInvoice>(`/sales/manual-invoices/${id}/`, data);
    },

    async deleteManualInvoice(id: number) {
        return apiClient.delete(`/sales/manual-invoices/${id}/`);
    },

    async downloadManualInvoicePDF(invoiceId: number) {
        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const token = typeof window !== 'undefined' ? localStorage.getItem('salexa_access_token') : null;

            const response = await fetch(`${apiBaseUrl}/sales/manual-invoices/${invoiceId}/download_pdf/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to download PDF (Status: ${response.status})`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Manual-Invoice-${invoiceId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("PDF Download error:", error);
            throw error;
        }
    },

    async markManualInvoiceAsPaid(id: number, paymentReference: string, paymentDate?: string) {
        return apiClient.post(`/sales/manual-invoices/${id}/mark_as_paid/`, {
            payment_reference: paymentReference,
            payment_date: paymentDate
        });
    },

    // ===== Adjustment Notes (Credit/Debit) =====
    async getAdjustments(params?: Record<string, string>) {
        return apiClient.get<{ results: AdjustmentNote[], count: number }>('/sales/adjustments/', params);
    },

    async createAdjustment(data: Partial<AdjustmentNote>) {
        return apiClient.post<AdjustmentNote>('/sales/adjustments/', data);
    },

    async updateAdjustment(id: number, data: Partial<AdjustmentNote>) {
        return apiClient.patch<AdjustmentNote>(`/sales/adjustments/${id}/`, data);
    },

    async searchInvoicesForAdjustment(noteType: 'credit' | 'debit', query: string, limit: number = 8, offset: number = 0) {
        return apiClient.get<{ results: any[], has_more: boolean, count: number }>('/sales/adjustments/invoice_search/', {
            note_type: noteType,
            q: query,
            limit: limit.toString(),
            offset: offset.toString()
        });
    },
};

export interface AdjustmentNote {
    id: number;
    note_number: string;
    note_type: 'credit' | 'debit';
    sales_invoice?: number;
    manual_invoice?: number;
    stock_request_invoice?: number;
    adjustment_amount: number;
    reason: string;
    adjustment_date: string;
    status: string;
    customer_name: string;
    invoice_number: string;
}
