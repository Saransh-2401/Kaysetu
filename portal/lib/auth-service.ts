/**
 * Authentication API Service
 * Handles login, logout, user management
 */

import { apiClient, tokenManager } from './api-client';

export interface LoginCredentials {
    org_code: string;   // SaaS: which tenant this user belongs to
    email: string;
    password: string;
}

export interface OrgContext {
    org_code: string;
    name: string;
    industry: string;
    labels: Record<string, string>;
    appearance: { scheme?: string };
    setup_state: { done?: string[]; completed?: boolean };
    modules: string[];
    status: string;
    trial_ends_at: string | null;
}

export interface LoginResponse {
    access: string;
    refresh: string;
    user: {
        id: number;
        email: string;
        username: string;
        full_name: string;
        role: string;
    };
    org?: OrgContext;
}

export interface UserProfile {
    id: number;
    email: string;
    username: string;
    full_name: string;
    phone: string;
    profile_image?: string | null;
    role: string;
    is_active: boolean;
    department?: string;
    employee_id?: string;
    region?: string;
    operating_city?: string;
    operating_pincodes?: string[];
    assigned_to?: number | null;
}

export interface Distributor {
    id: number;
    username: string;
    full_name: string;
    email?: string;
    assigned_to?: number;
    assigned_agent?: number;
}

export interface SalesAgent {
    id: number;
    username: string;
    full_name: string;
    email?: string;
}

export interface SalesManager {
    id: number;
    username: string;
    full_name: string;
    email?: string;
}

/**
 * Authentication Service
 */
export const authService = {
    /**
     * Login user
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        // SaaS org-scoped login: POST /api/auth/tenant/login (no trailing slash),
        // body {org_code, email, password}. Returns tokens + user + org context.
        const raw = await apiClient.post<any>('/auth/tenant/login', {
            org_code: credentials.org_code,
            email: credentials.email,
            password: credentials.password,
        });

        const response: LoginResponse = {
            access: raw.access,
            refresh: raw.refresh,
            user: {
                id: raw.user?.id,
                email: raw.user?.email ?? '',
                // TenantUser has no username — synthesise from email so the
                // portal's full_name||username display/forms keep working.
                username: raw.user?.username ?? raw.user?.email ?? '',
                full_name: raw.user?.full_name ?? '',
                role: raw.user?.role ?? '',
            },
            org: raw.org,
        };

        tokenManager.setAccessToken(response.access);
        tokenManager.setRefreshToken(response.refresh);
        if (credentials.org_code) tokenManager.setOrgCode(credentials.org_code);
        if (response.org && typeof window !== 'undefined') {
            localStorage.setItem('salexa_org_context', JSON.stringify(response.org));
        }

        return response;
    },

    /**
     * Cached org context from the last login (labels, appearance, modules).
     */
    getOrgContext(): OrgContext | null {
        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem('salexa_org_context');
        return raw ? (JSON.parse(raw) as OrgContext) : null;
    },

    /**
     * Logout user
     */
    logout(): void {
        // Purely local: the SaaS backend has no server-side session/token
        // revocation to invoke. Clearing immediately prevents an error flash
        // from background 401s during the redirect window.
        this.clearCache();
        tokenManager.clearTokens();
        if (typeof window !== 'undefined') {
            localStorage.removeItem('salexa_org_context');
        }
    },

    /**
     * Cache for current user to prevent redundant calls
     */
    _currentUser: null as UserProfile | null,

    /**
     * Get current user profile
     */
    async getCurrentUser(): Promise<UserProfile> {
        if (this._currentUser) return this._currentUser;
        const user = await apiClient.get<UserProfile>('/auth/users/me/');
        this._currentUser = user;
        return user;
    },

    /**
     * Clear cached user
     */
    clearCache() {
        this._currentUser = null;
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return !!tokenManager.getAccessToken();
    },

    /**
     * Change password
     */
    async changePassword(
        userId: number,
        oldPassword: string,
        newPassword: string,
        newPasswordConfirm: string
    ): Promise<void> {
        await apiClient.patch(`/auth/users/${userId}/change_password/`, {
            old_password: oldPassword,
            new_password: newPassword,
            new_password_confirm: newPasswordConfirm,
        });
    },

    /**
     * Get assigned sales agents
     */
    async getAssignedSalesAgents(params?: any): Promise<SalesAgent[]> {
        return apiClient.get<SalesAgent[]>('/auth/assigned-sales-agents/', params);
    },

    /**
     * Get assigned sales managers
     */
    async getAssignedSalesManagers(): Promise<SalesManager[]> {
        return apiClient.get<SalesManager[]>('/auth/assigned-sales-managers/');
    },

    /**
     * Get assigned distributors
     */
    async getAssignedDistributors(): Promise<Distributor[]> {
        return apiClient.get<Distributor[]>('/auth/assigned-distributors/');
    },

    /**
     * Send OTP to phone number (Sales Agents only)
     */
    async sendOTP(phoneNumber: string): Promise<{ message: string }> {
        return apiClient.post<{ message: string }>('/auth/send-otp/', { phoneNumber });
    },

    /**
     * Verify OTP and return JWT tokens.
     * Backend returns { token, refreshToken } (mobile format) — normalized here to LoginResponse.
     */
    async verifyOTP(phoneNumber: string, otp: string): Promise<LoginResponse> {
        const raw = await apiClient.post<any>('/auth/verify-otp/', { phoneNumber, otp });
        const response: LoginResponse = {
            access: raw.access ?? raw.token,
            refresh: raw.refresh ?? raw.refreshToken,
            user: {
                id: raw.user?.id,
                email: raw.user?.email ?? '',
                username: raw.user?.username ?? raw.user?.name ?? '',
                full_name: raw.user?.full_name ?? raw.user?.name ?? '',
                role: raw.user?.role,
            },
        };
        tokenManager.setAccessToken(response.access);
        tokenManager.setRefreshToken(response.refresh);
        return response;
    },
};
