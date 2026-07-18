/**
 * Purchase API Service
 * Handles suppliers, material requests, RFQ, purchase orders
 */

import { apiClient, API_BASE_URL, tokenManager } from './api-client';

// ============ Types ============

export interface SupplierLedgerLine {
    date: string | null;
    ref: string;
    type: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export interface SupplierLedger {
    supplier: { id: number; name: string };
    currency: string;
    opening_balance: number;
    lines: SupplierLedgerLine[];
    closing_balance: number;
}

export interface Supplier {
    id: number;
    supplier_code: string;
    supplier_name: string;
    business_name: string;
    supplier_group?: string;
    contact_person?: string;
    email: string;
    phone: string;
    tax_id?: string;
    payment_terms?: string;
    notes?: string;
    bank_details?: Record<string, string>;
    billing_address?: string;
    is_active: boolean;
    supplied_items?: number[];
    supplied_items_details?: any[];
    outstanding_balance?: number;
    last_po_date?: string;
    po_count?: number;
    total_spent?: number;
    quality_rating?: number;
}

export interface MaterialRequestItem {
    id?: number;
    item: number;
    item_name?: string;
    item_code?: string;
    quantity: number;
    uom?: string;
    estimated_rate: number;
    supplier?: number;
    supplier_name?: string;
    specification?: string;
}

export interface MaterialRequest {
    id: number;
    request_number: string;
    department: string;
    project?: string;
    required_date: string;
    target_warehouse: number;
    target_warehouse_name?: string;
    purpose?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    request_status: string;
    status: string;
    total_amount?: number;
    items?: MaterialRequestItem[];
    production_plan?: number;
    production_plan_number?: string;
    purchase_orders_details?: PurchaseOrder[]; // For payment status tracking
    created_at?: string;
    updated_at?: string;
    created_by_name?: string;
    status_history?: any[];
}

export interface PurchaseOrder {
    id: number;
    po_number: string;
    supplier: number;
    supplier_name?: string;
    supplier_business_name?: string;
    order_date: string;
    delivery_date: string;
    total: number;
    subtotal?: number;
    tax_amount?: number;
    tax_type?: 'cgst_sgst' | 'igst';
    is_tax_inclusive?: boolean;
    payment_terms: string;
    payment_status: 'unpaid' | 'paid';
    payment_reference?: string;
    receipt_status: string;
    status: string;
    status_history?: any[];
    items?: any[];
    material_request?: number;
    material_request_number?: string;
}

export interface PurchaseExpenseReport {
    summary: {
        total_expense: number;
        paid: number;
        unpaid: number;
        po_count: number;
    };
    by_supplier: { supplier: string; po_count: number; total: number; paid: number; unpaid: number }[];
    by_month: { month: string; po_count: number; total: number }[];
    rows: {
        po_number: string;
        supplier: string;
        order_date: string;
        total: number;
        payment_status: string;
        receipt_status: string;
    }[];
}

export interface SupplierPriceHistoryItem {
    item_id: number;
    item_name: string;
    item_code: string;
    uom: string;
    last_rate: number;
    last_po_number: string;
    last_order_date: string | null;
    po_count: number;
    min_rate: number;
    max_rate: number;
    avg_rate: number;
    history: { po_number: string; order_date: string | null; rate: number; quantity: number }[];
}

// ============ Service ============

export const purchaseService = {
    // ===== Suppliers =====
    async getSuppliers(params?: Record<string, string>) {
        return apiClient.get<{ results: Supplier[] }>('/t/purchase/suppliers/', params);
    },

    async getSupplier(id: number) {
        return apiClient.get<Supplier>(`/t/purchase/suppliers/${id}/`);
    },

    /** Per-item negotiated-rate history for one supplier (from PO line items). */
    async getSupplierPriceHistory(id: number) {
        return apiClient.get<{ count: number; results: SupplierPriceHistoryItem[] }>(`/t/purchase/suppliers/${id}/price-history/`);
    },

    // Suppliers are foundation Parties; the BOOKS-backed party ledger serves both
    // customer and supplier statements via one decoupled foundation URL.
    async getSupplierLedger(id: number, params?: Record<string, string>) {
        return apiClient.get<SupplierLedger>(`/t/parties/${id}/ledger/`, params);
    },

    async createSupplier(data: Partial<Supplier>) {
        return apiClient.post<Supplier>('/t/purchase/suppliers/', data);
    },

    async updateSupplier(id: number, data: Partial<Supplier>) {
        return apiClient.patch<Supplier>(`/t/purchase/suppliers/${id}/`, data);
    },

    async deleteSupplier(id: number) {
        return apiClient.delete(`/t/purchase/suppliers/${id}/`);
    },

    // ===== Material Requests =====
    async getMaterialRequests(params?: Record<string, string>) {
        return apiClient.get<{ results: MaterialRequest[] }>('/t/purchase/material-requests/', params);
    },

    async getMaterialRequest(id: number) {
        return apiClient.get<MaterialRequest>(`/t/purchase/material-requests/${id}/`);
    },

    async createMaterialRequest(data: Partial<MaterialRequest> & { items: MaterialRequestItem[] }) {
        return apiClient.post<MaterialRequest>('/t/purchase/material-requests/', data);
    },

    async updateMaterialRequest(id: number, data: Partial<MaterialRequest> & { items?: MaterialRequestItem[] }) {
        return apiClient.patch<MaterialRequest>(`/t/purchase/material-requests/${id}/`, data);
    },

    async deleteMaterialRequest(id: number) {
        return apiClient.delete(`/t/purchase/material-requests/${id}/`);
    },

    async submitMaterialRequest(id: number) {
        return apiClient.post(`/t/purchase/material-requests/${id}/submit/`, {});
    },

    async approveMaterialRequest(id: number) {
        return apiClient.post(`/t/purchase/material-requests/${id}/approve/`, {});
    },

    async rejectMaterialRequest(id: number, reason: string) {
        return apiClient.post(`/t/purchase/material-requests/${id}/reject/`, { reason });
    },

    // Admin-only: override a material request to any status (with audit trail)
    async overrideMaterialRequestStatus(id: number, request_status: string, notes?: string) {
        return apiClient.post<MaterialRequest>(`/t/purchase/material-requests/${id}/override_status/`, { request_status, notes });
    },

    // ===== Purchase Orders =====
    async getPurchaseOrders(params?: Record<string, string>) {
        return apiClient.get<{ results: PurchaseOrder[] }>('/t/purchase/purchase-orders/', params);
    },

    async getPurchaseOrder(id: number) {
        return apiClient.get<PurchaseOrder>(`/t/purchase/purchase-orders/${id}/`);
    },

    async createPurchaseOrder(data: any) {
        return apiClient.post<PurchaseOrder>('/t/purchase/purchase-orders/', data);
    },

    // Standalone PO creation (admin/accounts) — auto PO number + totals server-side
    async createDirectPurchaseOrder(data: {
        supplier: number; tax_type: string; order_date?: string; delivery_date?: string;
        is_tax_inclusive?: boolean;
        items: { item: number; quantity: number; rate: number; cgst_rate?: number; sgst_rate?: number; igst_rate?: number }[];
    }) {
        return apiClient.post<PurchaseOrder>('/t/purchase/purchase-orders/create-direct/', data);
    },

    // Admin-only: override a PO's receipt and/or payment status (with audit trail)
    async overridePurchaseOrderStatus(id: number, data: { receipt_status?: string; payment_status?: string; notes?: string }) {
        return apiClient.post<PurchaseOrder>(`/t/purchase/purchase-orders/${id}/override_status/`, data);
    },

    // Aggregated PO expense report (totals by supplier / date / status)
    async getPurchaseExpenseReport(params?: Record<string, string>) {
        return apiClient.get<PurchaseExpenseReport>('/t/purchase/purchase-orders/expense_report/', params);
    },

    async submitPurchaseOrder(id: number) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/submit/`, {});
    },

    async approvePurchaseOrder(id: number, notes?: string) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/approve/`, { notes });
    },

    async sendToAccounts(id: number) {
        return apiClient.post(`/t/purchase/material-requests/${id}/send_to_accounts/`, {});
    },

    async generatePOs(id: number, data: { order_date: string; delivery_date?: string; tax_type?: string; is_tax_inclusive: boolean; items?: any[] }) {
        return apiClient.post<{ message: string; po_numbers: string[]; skipped_items?: string[] }>(`/t/purchase/material-requests/${id}/generate_purchase_orders/`, data);
    },

    async markReceived(id: number) {
        return apiClient.post(`/t/purchase/material-requests/${id}/mark_received/`, {});
    },

    async markStocked(id: number) {
        return apiClient.post(`/t/purchase/material-requests/${id}/mark_stocked/`, {});
    },

    async markPoPaid(id: number, payment_reference: string) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/mark_paid/`, { payment_reference });
    },

    async closePurchaseOrder(id: number) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/close_order/`, {});
    },

    // Warehouse Receiving Workflow
    async markShipmentArrived(id: number) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/mark_shipment_arrived/`, {});
    },

    async markPoStocked(id: number) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/mark_stocked/`, {});
    },

    async markPartiallyReceived(id: number, items: Array<{ id: number; newly_received: number }>) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/mark_partially_received/`, { items });
    },

    async markMissingReceived(id: number) {
        return apiClient.post(`/t/purchase/purchase-orders/${id}/mark_missing_received/`, {});
    },

    async downloadMRPDF(id: number) {
        const token = tokenManager.getAccessToken();
        const response = await fetch(`${API_BASE_URL}/t/purchase/material-requests/${id}/download_pdf/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to download PDF');
        return response.blob();
    },

    async downloadPOPDF(id: number) {
        const token = tokenManager.getAccessToken();
        const response = await fetch(`${API_BASE_URL}/t/purchase/purchase-orders/${id}/download_pdf/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to download PDF');
        return response.blob();
    }
};
