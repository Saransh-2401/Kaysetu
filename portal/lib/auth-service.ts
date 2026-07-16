/**
 * Authentication API Service
 * Handles login, logout, user management
 */

import { apiClient, tokenManager } from './api-client';

export interface LoginCredentials {
    email: string;
    password: string;
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
        const response = await apiClient.post<LoginResponse>(
            '/auth/login/',
            credentials
        );

        // Store tokens
        tokenManager.setAccessToken(response.access);
        tokenManager.setRefreshToken(response.refresh);

        return response;
    },

    /**
     * Logout user
     */
    logout(): void {
        const refreshToken = tokenManager.getRefreshToken();

        // Clear tokens immediately — prevents error flash from background
        // intervals making 401 requests during the redirect window
        this.clearCache();
        tokenManager.clearTokens();

        // Notify server in background (best-effort, non-blocking)
        if (refreshToken) {
            apiClient.post('/auth/users/logout/', { refresh_token: refreshToken })
                .catch(() => {});
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
