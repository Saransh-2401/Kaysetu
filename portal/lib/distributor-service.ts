import { apiClient } from './api-client';

export interface Product {
    id: number;
    product_name: string;
    sku: string;
    hsn_code: string;
    description: string;
    product_image: string | null;
    mrp: string | number;
    selling_price: string | number;
    uom: string;
    distributor_stock?: number;
}

export interface DistributorInventory {
    id: number;
    distributor: number;
    distributor_name: string;
    product: number;
    product_details: Product;
    current_stock: number;
    low_stock_threshold: number;
    created_at: string;
    updated_at: string;
}

export interface StockRequestItem {
    id?: number;
    product: number;
    product_name?: string;
    sku?: string;
    hsn_code?: string;
    product_tax_rate?: number;
    requested_quantity: number;
    approved_quantity?: number;
    shortage_quantity?: number;
    unit_price?: number;
    total_price?: number;
}

export interface StockRequestShortage {
    id: number;
    stock_request: number;
    stock_request_number: string;
    product: number;
    product_name: string;
    product_hsn?: string;
    sku: string;
    product_tax_rate?: number;
    shortage_quantity: number;
    status: 'pending' | 'in_production' | 'completed' | 'packed' | 'in_transit' | 'delivered' | 'cancelled';
    is_invoiced: boolean;
    invoice?: number;
    payment_status: string;
    production_plan_id?: number;
    notes: string;
    created_at: string;
    status_logs?: any[];
}

export interface StockRequestInvoiceItem {
    id?: number;
    product: number;
    product_name?: string;
    sku?: string;
    quantity: number;
    unit_price: number;
    hsn_code?: string;
    product_tax_rate?: number;
    shortage_id?: number; // Link to shortage if applicable
    cgst_rate?: number;
    cgst_amount?: number;
    sgst_rate?: number;
    sgst_amount?: number;
    igst_rate?: number;
    igst_amount?: number;
    cess_rate?: number;
    cess_amount?: number;
    taxable_value?: number;
    total_price: number;
}

export interface StockRequestInvoice {
    id: number;
    invoice_number: string;
    invoice_date?: string;
    due_date?: string;
    is_tax_inclusive: boolean;
    tax_input_mode?: 'percentage' | 'rupee';
    subtotal: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    cess_amount: number;
    total_tax: number;
    discount_type: 'percentage' | 'amount';
    discount_value: number;
    discount_amount: number;
    total_amount: number;
    payment_status: string;
    payment_reference?: string;
    invoice_type?: 'partial' | 'full' | 'shortage_only';
    notes: string;
    billing_address?: string;
    shipping_address?: string;
    gst_number?: string;
    items: StockRequestInvoiceItem[];
    generated_by_name: string;
    generated_at: string;
}

export interface StockRequest {
    id: number;
    request_number: string;
    distributor: number;
    distributor_name: string;
    distributor_address?: string;
    distributor_shipping_address?: string;
    distributor_gst?: string;
    status: 'pending' | 'approved' | 'partial_fulfilled' | 'backordered' | 'in_production' | 'packed' | 'in_transit' | 'partially_delivered' | 'delivered' | 'cancelled';
    payment_status: 'unpaid' | 'invoiced' | 'paid' | 'overdue';
    payment_date?: string;
    payment_reference?: string;
    request_date: string;
    description: string;
    items: StockRequestItem[];
    invoices?: StockRequestInvoice[];
    shortages?: StockRequestShortage[];
    approved_by?: number;
    approved_by_name?: string;
    approved_at?: string;
    dispatched_at?: string;
    packed_at?: string;
    delivered_at?: string;
    invoice_generated_at?: string;
    has_shortage?: boolean;
    production_notes?: string;
    status_logs?: any[];
    created_at: string;
    updated_at: string;
}

export const distributorService = {
    // Inventory
    getInventory: async () => {
        return await apiClient.get<DistributorInventory[]>('/t/dist/inventory/');
    },

    getProductMaster: async (distributorId?: number) => {
        const params: Record<string, string> | undefined = distributorId ? { distributor_id: distributorId.toString() } : undefined;
        return await apiClient.get<Product[]>('/t/dist/inventory/products/', params);
    },

    getAdjustments: async (params?: Record<string, string>) => {
        return await apiClient.get<any>('/t/dist/adjustments/', params);
    },

    createAdjustment: async (data: any) => {
        return await apiClient.post<any>('/t/dist/adjustments/', data);
    },

    // Stock Requests
    getStockRequests: async (params?: Record<string, string>) => {
        return await apiClient.get<StockRequest[]>('/t/dist/requests/', params);
    },

    createStockRequest: async (data: { description: string; items: { product: number; requested_quantity: number }[] }) => {
        return await apiClient.post<StockRequest>('/t/dist/requests/', data);
    },

    getStockRequest: async (id: number) => {
        return await apiClient.get<StockRequest>(`/t/dist/requests/${id}/`);
    },
    updateStockRequest: async (id: number, data: { description: string; items: { product: number; requested_quantity: number }[] }) => {
        return await apiClient.put<StockRequest>(`/t/dist/requests/${id}/`, data);
    },

    checkStockInventory: async (id: number) => {
        return await apiClient.get<any[]>(`/t/dist/requests/${id}/check_inventory/`);
    },

    approveStockRequest: async (id: number, notes?: string) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${id}/approve/`, { notes });
    },

    cancelStockRequest: async (id: number, notes?: string) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${id}/cancel/`, { notes });
    },

    markPacked: async (id: number, notes?: string) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${id}/mark_packed/`, { notes });
    },

    markInTransit: async (id: number, notes?: string) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${id}/mark_in_transit/`, { notes });
    },

    markDelivered: async (id: number, notes?: string) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${id}/mark_delivered/`, { notes });
    },

    updatePaymentStatus: async (id: number, status: 'paid' | 'unpaid' | 'invoiced' | 'overdue', reference?: string, notes?: string) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${id}/update_payment_status/`, { status, notes, reference });
    },

    generateInvoice: async (id: number, data: any) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${id}/generate_invoice/`, data);
    },

    deleteInvoice: async (requestId: number, invoiceId: number) => {
        return await apiClient.post<StockRequest>(`/t/dist/requests/${requestId}/delete_invoice/`, { invoice_id: invoiceId });
    },

    getCompanyDetails: async () => {
        return await apiClient.get<any>('/core/companies/current/');
    },

    // Shortages & Production
    getShortages: async () => {
        return await apiClient.get<any[]>('/t/dist/shortages/');
    },

    startShortageProduction: async (id: number) => {
        return await apiClient.post(`/t/dist/shortages/${id}/start_production/`, {});
    },

    completeShortageProduction: async (id: number) => {
        return await apiClient.post(`/t/dist/shortages/${id}/complete_production/`, {});
    },

    generateShortageInvoice: async (id: number) => {
        return await apiClient.post(`/t/dist/shortages/${id}/generate_invoice/`, {});
    },

    markShortagePaid: async (id: number, data?: { payment_reference?: string }) => {
        return await apiClient.post(`/t/dist/shortages/${id}/mark_paid/`, data || {});
    },
    packShortage: async (id: number, notes?: string) => {
        return await apiClient.post(`/t/dist/shortages/${id}/mark_packed/`, { notes });
    },
    shipShortage: async (id: number, notes?: string) => {
        return await apiClient.post(`/t/dist/shortages/${id}/mark_in_transit/`, { notes });
    },
    deliverShortage: async (id: number, notes?: string) => {
        return await apiClient.post(`/t/dist/shortages/${id}/mark_delivered/`, { notes });
    },

    // Batch operations — act on ALL eligible items under a stock request in one call
    batchPackShortages: async (stockRequestId: number): Promise<{ results: any[]; any_packed: boolean }> => {
        return await apiClient.post(`/t/dist/shortages/batch_pack/`, { stock_request_id: stockRequestId });
    },
    batchShipShortages: async (stockRequestId: number): Promise<{ results: any[]; any_shipped: boolean }> => {
        return await apiClient.post(`/t/dist/shortages/batch_ship/`, { stock_request_id: stockRequestId });
    },
    batchDeliverShortages: async (stockRequestId: number): Promise<{ results: any[]; any_delivered: boolean }> => {
        return await apiClient.post(`/t/dist/shortages/batch_deliver/`, { stock_request_id: stockRequestId });
    },


    // Invoices
    getMyInvoices: async () => {
        return await apiClient.get<any[]>('/t/dist/invoices/my_invoices/');
    },

    downloadInvoicePDF: async (invoiceId: number, invoiceNumber: string) => {
        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
            const token = typeof window !== 'undefined' ? localStorage.getItem('salexa_access_token') : null;

            const response = await fetch(`${apiBaseUrl}/distributor-inventory/invoices/${invoiceId}/download_pdf/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = 'Failed to download PDF';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.detail || JSON.stringify(errorData);
                } catch {
                    errorMessage = `Failed to download PDF (Status: ${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            throw error;
        }
    },

    // Sales Invoices (Distributor -> Client)
    getSalesInvoices: async (params?: Record<string, string>) => {
        return await apiClient.get<any>('/sales/invoices/', params);
    },

    downloadSalesInvoicePDF: async (invoiceId: number, invoiceNumber: string) => {
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
                let errorMessage = 'Failed to download PDF';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.detail || JSON.stringify(errorData);
                } catch {
                    errorMessage = `Failed to download PDF (Status: ${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${invoiceNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading Sales PDF:', error);
            throw error;
        }
    }
};
