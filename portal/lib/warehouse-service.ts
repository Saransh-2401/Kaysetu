/**
 * Warehouse API Service
 * Handles items, warehouses, stock entries
 */

import { apiClient } from './api-client';

// ============ Types ============

export interface Item {
    id: number;
    item_code: string;
    item_name: string;
    category: string;
    item_type: string;
    uom: string;
    hsn_code?: string;
    standard_rate: number;
    valuation_rate?: number;
    maintain_stock: boolean;
    is_active: boolean;
    created_at: string;
}

export interface Product {
    id: number;
    product_name: string;
    sku: string;
    hsn_code?: string;
    description: string;
    product_image?: string;
    mrp: number;
    selling_price: number;
    price_includes_tax: boolean;
    tax_slab?: number;
    tax_slab_name?: string;
    tax_percentage?: number;
    quantity: number;
    uom: string;
    low_stock_threshold: number;
    status: 'active' | 'inactive' | 'archived';
    product_location?: string;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    shipping_class?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Warehouse {
    id: number;
    warehouse_name: string;
    abbreviation: string;
    warehouse_type: string;
    is_active: boolean;
}

export interface StockEntry {
    id: number;
    entry_number: string;
    stock_type?: 'item' | 'product';
    entry_type: string;
    entry_date: string;
    source_warehouse?: number;
    target_warehouse?: number;
    is_submitted: boolean;
    remarks?: string;
    created_by_name?: string;
    items?: StockEntryItem[];
}

export interface StockEntryItem {
    id?: number;
    item?: number;
    product?: number;
    item_name?: string;
    item_code?: string;
    product_name?: string;
    product_sku?: string;
    uom?: string;
    quantity: number;
    previous_stock?: number;
    new_stock?: number;
    rate: number;
    amount: number;
}

export interface StockLedger {
    id: number;
    item: number;
    product?: number;
    item_name?: string;
    item_code?: string;
    product_name?: string;
    product_sku?: string;
    warehouse: number;
    warehouse_name?: string;
    warehouse_abbreviation?: string;
    transaction_date: string;
    voucher_type: string;
    voucher_no: string;
    voucher_id: number;
    quantity: number;
    balance_qty: number;
    uom: string;
    valuation_rate: number;
    stock_value: number;
    batch_no?: string;
    serial_no?: string;
}

export interface LowStockItem {
    id: number;
    item_code: string;
    item_name: string;
    uom: string;
    current_stock: number;
    reorder_level: number;
    reorder_quantity: number;
    shortfall: number;
    is_out_of_stock: boolean;
}

// ============ Service ============

export const warehouseService = {
    // ===== Items =====
    async getItems(params?: Record<string, string>) {
        return apiClient.get<{ results: Item[] }>('/warehouse/items/', params);
    },

    /** Raw materials at or below their reorder level (procurement low-stock alert). */
    async getLowStockItems() {
        return apiClient.get<{ count: number; results: LowStockItem[] }>('/warehouse/items/low_stock/');
    },

    async getItem(id: number) {
        return apiClient.get<Item>(`/warehouse/items/${id}/`);
    },

    async createItem(data: Partial<Item>) {
        return apiClient.post<Item>('/warehouse/items/', data);
    },

    async updateItem(id: number, data: Partial<Item>) {
        return apiClient.patch<Item>(`/warehouse/items/${id}/`, data);
    },

    /** Directly set an item's on-hand stock (no validation/dependencies). */
    async setItemStock(id: number, quantity: number, warehouse?: number) {
        return apiClient.post<{ success: boolean; previous_stock: number; current_stock: number; warehouse: string }>(
            `/warehouse/items/${id}/set-stock/`,
            warehouse != null ? { quantity, warehouse } : { quantity }
        );
    },

    /** Suppliers that supply a given item (raw material). */
    async getItemSuppliers(id: number) {
        return apiClient.get<Array<{
            id: number; supplier_code: string; supplier_name: string; business_name: string;
            email: string; phone: string; supplier_group: string | null; is_active: boolean;
        }>>(`/warehouse/items/${id}/suppliers/`);
    },

    // ===== Products =====
    async getProducts(params?: Record<string, string>) {
        return apiClient.get<{ count: number, results: Product[] }>('/warehouse/products/', params);
    },

    async getProduct(id: number) {
        return apiClient.get<Product>(`/warehouse/products/${id}/`);
    },

    async createProduct(data: Partial<Product> | FormData) {
        return apiClient.post<Product>('/warehouse/products/', data);
    },

    async updateProduct(id: number, data: Partial<Product> | FormData) {
        return apiClient.patch<Product>(`/warehouse/products/${id}/`, data);
    },

    async deleteProduct(id: number) {
        return apiClient.delete(`/warehouse/products/${id}/`);
    },

    // ===== Warehouses =====
    async getWarehouses(params?: Record<string, string>) {
        return apiClient.get<{ results: Warehouse[] }>('/warehouse/warehouses/', params);
    },

    async getWarehouse(id: number) {
        return apiClient.get<Warehouse>(`/warehouse/warehouses/${id}/`);
    },

    async createWarehouse(data: Partial<Warehouse>) {
        return apiClient.post<Warehouse>('/warehouse/warehouses/', data);
    },

    // ===== Stock Entries =====
    async getStockEntries(params?: Record<string, string>) {
        return apiClient.get<{ results: StockEntry[], count: number }>('/warehouse/stock-entries/', params);
    },

    async getStockEntry(id: number) {
        return apiClient.get<StockEntry>(`/warehouse/stock-entries/${id}/`);
    },

    async createStockEntry(data: Partial<StockEntry> & { items: StockEntryItem[] }) {
        return apiClient.post<StockEntry>('/warehouse/stock-entries/', data);
    },

    async submitStockEntry(id: number) {
        return apiClient.post(`/warehouse/stock-entries/${id}/submit/`, {});
    },

    // ===== Stock Ledger (Read-only) =====
    async getStockLedger(params?: Record<string, string>) {
        return apiClient.get<{ results: StockLedger[], count: number }>('/warehouse/stock-ledger/', params);
    },

    async getStockLedgerActivity(id: number) {
        return apiClient.get<StockLedgerActivity>(`/warehouse/stock-ledger/${id}/activity/`);
    },
};

export interface StockLedgerActivityEvent {
    timestamp: string;
    title: string;
    note: string;
    actor: string;
}

export interface StockLedgerActivity {
    ledger: {
        id: number;
        voucher_type: string;
        voucher_no: string;
        transaction_date: string;
        quantity: number;
        balance_qty: number;
        valuation_rate: number;
        stock_value: number;
        item_name: string | null;
        product_name: string | null;
        warehouse_name: string | null;
        batch_no: string;
    };
    source: { type: string; number: string; found: boolean; label?: string };
    events: StockLedgerActivityEvent[];
}
