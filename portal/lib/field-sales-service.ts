/**
 * Field Sales API Service
 * Handles visits, GPS tracking, daily reports
 */

import { apiClient } from './api-client';

// ============ Types ============

export interface Visit {
    id: number;
    agent: number;
    agent_name?: string;
    customer?: {
        id: number;
        customer_name: string;
        shop_image?: string;
    };
    customer_name?: string;
    lead?: {
        id: number;
        name: string;
    };
    lead_name?: string;
    visit_date: string;
    scheduled_time: string;
    actual_checkin_time?: string;
    actual_checkout_time?: string;
    checkin_location?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    checkout_location?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    visit_type: string;
    purpose?: string;
    outcome?: string;
    checkout_notes?: string;
    checkin_selfie?: string;
    voice_note_url?: string;
    images?: Array<{
        id: number;
        image_url: string;
        image_type: string;
    }>;
    status: string;
    notes?: string;
    created_at?: string;
    lead_status_at_checkout?: string;
}

export interface AgentLocation {
    id: number;
    agent: number;
    agent_name?: string;
    timestamp: string;
    latitude: number;
    longitude: number;
    transport_mode?: string;
    speed?: number;
    accuracy?: number;
}

export interface DailyReport {
    id: number;
    agent: number;
    agent_name?: string;
    date: string;
    visits_planned: number;
    visits_completed: number;
    orders_booked: number;
    leads_generated: number;
    distance_traveled_km: number;
    working_hours: number;
}

// ============ Service ============

export const fieldSalesService = {
    // ===== Visits =====
    async getVisits(params?: Record<string, string>) {
        return apiClient.get<{ results: Visit[]; count: number }>('/t/field/visits/', params);
    },

    async getVisit(id: number) {
        return apiClient.get<Visit>(`/t/field/visits/${id}/`);
    },

    async createVisit(data: Partial<Visit>) {
        return apiClient.post<Visit>('/t/field/visits/', data);
    },

    async updateVisit(id: number, data: Partial<Visit>) {
        return apiClient.patch<Visit>(`/t/field/visits/${id}/`, data);
    },

    async checkinVisit(id: number, location: { latitude: number; longitude: number }) {
        return apiClient.post(`/t/field/visits/${id}/checkin/`, { location });
    },

    async checkoutVisit(
        id: number,
        location: { latitude: number; longitude: number },
        notes?: string
    ) {
        return apiClient.post(`/t/field/visits/${id}/checkout/`, { location, notes });
    },

    // ===== Agent Locations (Real-time tracking) =====
    async getAgentLocations(params?: Record<string, string>) {
        return apiClient.get<{ results: AgentLocation[] }>('/field-sales/locations/', params);
    },

    async trackAgentLocation(data: {
        latitude: number;
        longitude: number;
        transport_mode?: string;
        speed?: number;
        accuracy?: number;
    }) {
        return apiClient.post<AgentLocation>('/field-sales/locations/', data);
    },

    // ===== Daily Reports =====
    async getDailyReports(params?: Record<string, string>) {
        return apiClient.get<{ results: DailyReport[] }>('/field-sales/daily-reports/', params);
    },

    async getDailyReport(id: number) {
        return apiClient.get<DailyReport>(`/field-sales/daily-reports/${id}/`);
    },

    async createDailyReport(data: Partial<DailyReport>) {
        return apiClient.post<DailyReport>('/field-sales/daily-reports/', data);
    },
};
