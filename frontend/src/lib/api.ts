"use client";
/**
 * API client for the ops console (SuperAdmin, control plane).
 * Tokens live in localStorage per scope; a 401 clears the scope and bounces
 * to the login page. (Refresh-token rotation lands with the auth hardening pass.)
 *
 * Tenant users NEVER sign in here — their app is the separate portal build
 * (PORTAL_URL). This app deliberately has no tenant-facing screens.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000/api";

/** Absolute URL of the tenant portal (the real customer-facing app). */
export const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001";

export type Scope = "ops";

const LOGIN_PAGE: Record<Scope, string> = { ops: "/ops/login" };

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Request failed (${status})`;
    super(detail);
    this.status = status;
    this.data = data;
  }
}

export function getToken(scope: Scope): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`kaysetu_${scope}_access`);
}

export function setSession(scope: Scope, tokens: { access: string; refresh: string }, context?: unknown) {
  localStorage.setItem(`kaysetu_${scope}_access`, tokens.access);
  localStorage.setItem(`kaysetu_${scope}_refresh`, tokens.refresh);
  if (context !== undefined) {
    localStorage.setItem(`kaysetu_${scope}_context`, JSON.stringify(context));
  }
}

export function getContext<T>(scope: Scope): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`kaysetu_${scope}_context`);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function clearSession(scope: Scope) {
  for (const key of ["access", "refresh", "context"]) {
    localStorage.removeItem(`kaysetu_${scope}_${key}`);
  }
}

export async function api<T = unknown>(
  scope: Scope | null,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (scope) {
    const token = getToken(scope);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* empty body */
  }
  if (!response.ok) {
    if (response.status === 401 && scope && typeof window !== "undefined") {
      clearSession(scope);
      if (!window.location.pathname.endsWith("/login")) {
        window.location.href = LOGIN_PAGE[scope];
      }
    }
    throw new ApiError(response.status, data);
  }
  return data as T;
}

// ---------------------------------------------------------------- types
export interface PublicPackage {
  code: string;
  name: string;
  tagline: string;
  modules: string[];
  is_addon: boolean;
  mobile_level: string;
  base_price_monthly: string;
  base_price_annual: string;
  included_users: number;
  per_user_price: string;
}

/** Mirrors the backend password rules (min 8, not all-numeric, not trivially
 * common). Returns an error message or null when acceptable. */
export function passwordError(password: string, confirm?: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (/^\d+$/.test(password)) return "Password cannot be only numbers.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Use at least one letter and one number.";
  if (confirm !== undefined && password !== confirm) return "Passwords do not match.";
  return null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
