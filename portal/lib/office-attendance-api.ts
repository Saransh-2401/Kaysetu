import { apiClient } from './api-client';

export interface AttendanceStatus {
  applicable: boolean;
  checked_in: boolean;
  checked_out: boolean;
  check_in_time: string | null;   // ISO datetime string
  check_out_time: string | null;
  check_out_type: 'manual' | 'auto' | null;
  working_hours: number;
}

export const officeAttendanceApi = {
  getToday: () =>
    apiClient.get<AttendanceStatus>('/office-attendance/today/'),

  checkIn: () =>
    apiClient.post<{ success: boolean; check_in_time: string }>('/office-attendance/check-in/', {}),

  checkOut: () =>
    apiClient.post<{ success: boolean; check_out_time: string; working_hours: number }>('/office-attendance/check-out/', {}),
};

/** Format working_hours (decimal) → "Xh Ym" */
export function formatWorkingHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format an ISO datetime string to local HH:MM */
export function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
