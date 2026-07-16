/**
 * Shared TypeScript interfaces for common components
 * This file contains all reusable type definitions for consistent typing across the application
 */

import { ReactNode } from "react";

// ============================================
// CARD COMPONENT TYPES
// ============================================

/**
 * Base props for all stat/metric cards
 */
export interface BaseCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
}

/**
 * Props for StatCard component (used in Admin, Accounts, Warehouse, etc.)
 */
export interface StatCardProps extends BaseCardProps {
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string | number;
  alert?: boolean;
  progress?: number;
}

/**
 * Props for KpiCard component (used in Sales Manager, Production, Purchase, etc.)
 */
export interface KpiCardProps extends BaseCardProps {
  subtext?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string | number;
  progress?: number;
}

/**
 * Props for MetricCard component (used in Sales Agent)
 */
export interface MetricCardProps extends BaseCardProps {
  subtext?: string;
  progress?: number;
}

// ============================================
// EVENT HANDLER TYPES
// ============================================

/**
 * Generic item type for list actions
 */
export interface ListItem {
  id: string | number;
  [key: string]: unknown;
}

/**
 * User type for user-related actions
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

/**
 * Lead type for lead-related actions
 */
export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Customer type for customer-related actions
 */
export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  type: string;
  [key: string]: unknown;
}

/**
 * Order type for order-related actions
 */
export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  amount: number;
  status: string;
  date: string;
  [key: string]: unknown;
}

/**
 * Material Request type
 */
export interface MaterialRequest {
  id: string;
  requestNumber: string;
  department: string;
  items: number;
  status: "pending" | "approved" | "rejected" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  [key: string]: unknown;
}

/**
 * Visit type for sales agent visits
 */
export interface Visit {
  id: string;
  customer: string;
  location: string;
  time: string;
  status: "pending" | "completed" | "cancelled";
  type: string;
  [key: string]: unknown;
}

/**
 * Log/Audit entry type
 */
export interface AuditLog {
  id: string;
  user: string;
  action: string;
  module: string;
  timestamp: string;
  ip: string;
  status: "success" | "failed";
  [key: string]: unknown;
}

// ============================================
// FORM FIELD CHANGE HANDLERS
// ============================================

/**
 * Generic change handler for form fields
 */
export type FieldChangeHandler = (field: string, value: unknown) => void;

/**
 * Item update handler for invoice/order line items
 */
export type ItemUpdateHandler = (
  id: number,
  field: string,
  value: unknown
) => void;

// ============================================
// CHART/RECHARTS TYPES
// ============================================

/**
 * Tooltip formatter function type
 */
export type TooltipFormatter = (
  value: number | string,
  name?: string
) => [string, string];

/**
 * Chart data point
 */
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

// ============================================
// THEME COLOR TYPES
// ============================================

/**
 * Allowed theme color keys from Material-UI palette
 */
export type ThemeColor =
  | "primary"
  | "secondary"
  | "success"
  | "error"
  | "warning"
  | "info";

/**
 * Status colors for priority/status indicators
 */
export type StatusColorMap = {
  [key: string]: string;
};

// ============================================
// PAGINATION & FILTERING
// ============================================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * API response with pagination
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  metadata: PaginationMeta;
}

/**
 * Filter params
 */
export interface FilterParams {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  [key: string]: string | number | boolean | undefined;
}

// ============================================
// API TYPES
// ============================================

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  metadata?: PaginationMeta;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Combined API response type
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
