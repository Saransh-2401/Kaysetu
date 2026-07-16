import { apiClient } from "./api-client";

export const analyticsService = {
    // Sales
    getSalesOverview: async (params?: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/sales/overview/", params);
        return response;
    },

    getSalesByCustomer: async () => {
        const response = await apiClient.get<any>("/analytics/sales/by-customer/");
        return response;
    },

    getSalesReports: async (params?: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/sales/reports/", params);
        return response;
    },

    // CRM
    getCRMAnalytics: async (params?: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/crm/leads-funnel/", params);
        return response;
    },

    // Field Sales
    getFieldSalesAnalytics: async (params?: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/field-sales/overview/", params);
        return response;
    },

    // Warehouse
    getWarehouseAnalytics: async (params?: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/warehouse/stock-levels/", params);
        return response;
    },

    // Admin Dashboard (comprehensive)
    getAdminDashboard: async (params?: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/admin/dashboard/", params);
        return response;
    },

    // Admin Reports drill-down (single agent / distributor)
    getAdminEntityDetail: async (params: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/admin/entity-detail/", params);
        return response;
    },

    // Sales-agent dashboard + reports (real, agent-scoped)
    getSalesAgentOverview: async (params?: Record<string, string>) => {
        const response = await apiClient.get<any>("/analytics/sales-agent/overview/", params);
        return response;
    },
};

