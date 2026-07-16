
import { apiClient } from './api-client';

export interface TaxSlab {
    id: number;
    name: string;
    percentage: number;
    hsn_codes: string[];
    description: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface UOM {
    id: number;
    uom_name: string;
    symbol: string;
    is_base_unit: boolean;
    conversion_factor: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export const mastersService = {
    // --- UOM (Unit of Measurement) ---
    async getUOMs(params?: Record<string, string>) {
        return apiClient.get<{ count: number, results: UOM[] }>('/masters/uom/', params);
    },

    // --- Tax Slabs ---
    async getTaxSlabs(params?: Record<string, string>) {
        return apiClient.get<{ count: number, results: TaxSlab[] }>('/masters/tax-slabs/', params);
    },

    async createTaxSlab(data: Partial<TaxSlab>) {
        return apiClient.post<TaxSlab>('/masters/tax-slabs/', data);
    },

    async updateTaxSlab(id: number, data: Partial<TaxSlab>) {
        return apiClient.patch<TaxSlab>(`/masters/tax-slabs/${id}/`, data);
    },

    async deleteTaxSlab(id: number) {
        return apiClient.delete(`/masters/tax-slabs/${id}/`);
    }
};
