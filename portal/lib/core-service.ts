
import { apiClient } from './api-client';
import type { CustomSchemeInput } from '@/theme/schemes';

export interface Company {
    id: number;
    name: string;
    abbreviation: string;
    country: string;
    default_currency: string;
    tax_id: string;
    registration_number: string;
    email: string;
    phone: string;
    website: string;
    logo?: string;
    full_address?: string;
    latitude?: number;
    longitude?: number;
    operating_cities?: string[];
    default_operating_city?: string;
    timezone: string;
    date_format: string;
    is_active: boolean;
    fiscal_month_start?: number;   // 1–12, e.g. 4 = April (Indian FY)
    fiscal_day_start?: number;     // 1–31
    office_start_time?: string;    // "HH:MM", e.g. "09:00"
    office_end_time?: string;      // "HH:MM", e.g. "18:00"
    active_color_scheme?: string;  // global CRM color-scheme key (e.g. "navy-gold", "custom")
    custom_color_scheme?: CustomSchemeInput | null; // palette used when active_color_scheme === "custom"
    active_font?: string;          // global CRM font key (e.g. "roboto", "inter")
}

// User Interface matching Backend
export interface User {
    id: number;
    email: string;
    username: string;
    full_name: string;
    phone: string;
    profile_image?: string;
    role: string;
    department?: string;
    region?: string;
    employee_id?: string;
    is_active: boolean;
    is_approved: boolean;
    date_joined: string;
    last_login?: string;
    operating_city?: string;
    operating_pincodes?: any;
    status: string;
    assigned_to?: number; // ID of Manager
    assigned_agent?: number; // ID of Sales Agent (for distributors)
    created_by?: number; // ID of Creator
    full_address?: string;
    latitude?: number;
    longitude?: number;
}

export const coreService = {
    async getCurrentCompany() {
        // Fetch specific current company action
        return apiClient.get<Company>('/core/companies/current/');
    },

    async updateCompany(id: number, data: Partial<Company> | FormData) {
        return apiClient.patch<Company>(`/core/companies/${id}/`, data);
    },

    // --- Appearance (global color scheme) ---
    async setActiveColorScheme(companyId: number, schemeKey: string) {
        return apiClient.patch<Company>(`/core/companies/${companyId}/`, { active_color_scheme: schemeKey });
    },

    async saveCustomColorScheme(companyId: number, custom: CustomSchemeInput) {
        return apiClient.patch<Company>(`/core/companies/${companyId}/`, {
            active_color_scheme: 'custom',
            custom_color_scheme: custom,
        });
    },

    // --- User Management ---
    async getUsers(params?: Record<string, string>) {
        return apiClient.get<User[]>('/t/users/', params);
    },

    async createUser(data: Partial<User> | FormData) {
        return apiClient.post<User>('/t/users/', data);
    },

    async updateUser(id: number, data: Partial<User> | FormData) {
        return apiClient.patch<User>(`/t/users/${id}/`, data);
    },

    async deleteUser(id: number) {
        return apiClient.delete(`/t/users/${id}/`);
    },

    // --- Email Templates ---
    async getEmailTemplates() {
        return apiClient.get<EmailTemplate[]>('/core/email-templates/');
    },

    async updateEmailTemplate(id: number, data: Partial<EmailTemplate>) {
        return apiClient.patch<EmailTemplate>(`/core/email-templates/${id}/`, data);
    },

    async testEmailTemplate(id: number, email: string) {
        return apiClient.post<{ status: string, message: string }>(`/core/email-templates/${id}/send_test/`, { email });
    },

    // --- Email Config ---
    async getEmailConfig() {
        return apiClient.get<EmailConfiguration>('/core/email-config/');
    },

    async updateEmailConfig(data: Partial<EmailConfiguration>) {
        // Using POST because it's a singleton ViewSet logic in backend
        return apiClient.post<EmailConfiguration>('/core/email-config/', data);
    },

    async verifyEmailConfig(data?: Partial<EmailConfiguration>) {
        return apiClient.post<{ status: string, message: string }>('/core/email-config/verify/', data);
    },

    async sendTestEmail(email: string) {
        return apiClient.post<{ status: string, message: string }>('/core/email-config/send_test/', { email });
    },

    // --- SMS ---
    async getSMSTemplates() {
        return apiClient.get<SMSTemplate[]>('/core/sms-templates/');
    },

    async updateSMSTemplate(id: number, data: Partial<SMSTemplate>) {
        return apiClient.patch<SMSTemplate>(`/core/sms-templates/${id}/`, data);
    },

    async testSMSTemplate(id: number, phone: string) {
        return apiClient.post<{ status: string, data: any }>(`/core/sms-templates/${id}/send_test/`, { phone });
    },

    async getSMSConfig() {
        return apiClient.get<SMSConfiguration>('/core/sms-config/');
    },

    async updateSMSConfig(data: Partial<SMSConfiguration>) {
        return apiClient.post<SMSConfiguration>('/core/sms-config/', data);
    }
};

export interface EmailTemplate {
    id: number;
    name: string;
    subject: string;
    body: string;
    trigger_key: string;
    available_variables: string[];
    is_active: boolean;
}

export interface EmailConfiguration {
    id: number;
    host: string;
    port: number;
    username: string;
    password?: string;          // write-only; never returned by the API
    password_set?: boolean;     // read-only flag: is a password stored?
    use_tls: boolean;
    use_ssl: boolean;
    default_from_email: string;
    from_name: string;
}

export interface SMSConfiguration {
    id?: number;
    api_key?: string;           // write-only; never returned by the API
    api_key_set?: boolean;      // read-only flag: is an API key stored?
    sender_id: string;
    entity_id: string;
}

export interface SMSTemplate {
    id: number;
    name: string;
    content: string;
    dlt_template_id: string;
    trigger_key: string;
    is_active: boolean;
}
