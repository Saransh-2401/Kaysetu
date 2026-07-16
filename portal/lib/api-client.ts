/**
 * API Configuration and Base Client
 * Handles all HTTP requests to Django backend with JWT authentication
 */

// API Base URL from environment.
// SaaS backend serves everything under /api (no /v1 version segment).
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'salexa_access_token';
const REFRESH_TOKEN_KEY = 'salexa_refresh_token';
// Org code (SaaS multi-tenant): the tenant a session belongs to.
const ORG_CODE_KEY = 'salexa_org_code';

/**
 * Token management utilities
 */
export const tokenManager = {
  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setAccessToken: (token: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    }
  },

  setRefreshToken: (token: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    }
  },

  clearTokens: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(ORG_CODE_KEY);
    }
  },

  getOrgCode: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ORG_CODE_KEY);
  },

  setOrgCode: (orgCode: string): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ORG_CODE_KEY, orgCode);
    }
  },
};

/**
 * API Error class
 */
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Base API client with automatic JWT token handling
 */
class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * Build headers with authentication
   */
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = tokenManager.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Handle API responses
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
      }));

      // Detect session invalidation (logged in from another device) — force logout
      if (response.status === 401) {
        const detail = (errorData?.detail || '').toString();
        const code = (errorData?.code || '').toString();
        if (detail.includes('Session expired') || code === 'session_invalidated') {
          tokenManager.clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login?reason=session_expired';
            // Return a never-resolving promise so no error is thrown/surfaced
            return new Promise<T>(() => {});
          }
        }
      }

      // Extract error message - prioritize 'message' field for user-friendly text
      const errorMessage = errorData.message ||
        errorData.detail ||
        (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message) ||
        'API Error';

      throw new APIError(
        errorMessage,
        response.status,
        errorData
      );
    }

    // Handle empty response (like 204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<string> {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new APIError('No refresh token available', 401);
    }

    // SaaS backend: POST /api/auth/refresh (no trailing slash) rotates BOTH tokens.
    const response = await fetch(`${this.baseURL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      tokenManager.clearTokens();
      throw new APIError('Token refresh failed', 401);
    }

    const data = await response.json();
    tokenManager.setAccessToken(data.access);
    if (data.refresh) tokenManager.setRefreshToken(data.refresh);
    return data.access;
  }

  /**
   * Make authenticated request with auto token refresh
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    // Cast to Record<string, string> to allow deletion
    const headers = this.getHeaders() as Record<string, string>;

    // If body is FormData, let browser set Content-Type with boundary
    if (options.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Token expired — try to refresh
      if (response.status === 401 && tokenManager.getRefreshToken()) {
        // Check if session was invalidated — redirect immediately, don't refresh
        const errorData = await response.clone().json().catch(() => ({}));
        const detail = (errorData?.detail || '').toString();
        const code = (errorData?.code || '').toString();

        if (detail.includes('Session expired') || code === 'session_invalidated') {
          tokenManager.clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login?reason=session_expired';
            return new Promise<T>(() => {});
          }
        }

        await this.refreshAccessToken();

        const retryHeaders = this.getHeaders() as Record<string, string>;
        if (options.body instanceof FormData) {
          delete retryHeaders['Content-Type'];
        }

        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...retryHeaders,
            ...options.headers,
          },
        });

        return this.handleResponse<T>(retryResponse);
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(
        error instanceof Error ? error.message : 'Network error'
      );
    }
  }

  /**
   * HTTP Methods
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? (data as FormData) : (data ? JSON.stringify(data) : undefined),
    });
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: isFormData ? (data as FormData) : JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: isFormData ? (data as FormData) : JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }
}

// Export singleton instance
export const apiClient = new APIClient(API_BASE_URL);
