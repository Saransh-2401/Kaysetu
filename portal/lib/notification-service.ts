import { apiClient } from './api-client';

/**
 * Client for the generalised notification system (backend app: apps.notifications).
 * Covers the in-app feed, per-user preferences (all roles), admin role-defaults,
 * and admin broadcast.
 */

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';

export interface ChannelMap {
  in_app: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
}

export interface NotificationEvent {
  key: string;
  label: string;
  description: string;
  category: string;
  audience: string[];
  defaults: ChannelMap;
  critical: boolean;
  mandatory: boolean;
  relevant?: boolean;
  effective?: ChannelMap;            // present in prefs / role-default payloads
  override?: Partial<ChannelMap>;    // explicit settings (sparse)
}

export interface NotificationCatalog {
  channels: NotificationChannel[];
  channel_labels: Record<string, string>;
  categories: string[];
  events: NotificationEvent[];
}

export interface FeedItem {
  id: number;
  event_key: string;
  subject: string;
  message: string;
  reference_doctype: string;
  reference_name: string;
  is_urgent: boolean;
  status: string;
  read_at: string | null;
  created_at: string;
  is_read: boolean;
}

export interface FeedResponse {
  count: number;
  unread: number;
  results: FeedItem[];
}

export interface FeedSummary {
  unread: number;
  total: number;
}

export interface MyPreferences {
  muted: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  channels: NotificationChannel[];
  channel_labels: Record<string, string>;
  categories: string[];
  role: string | null;
  events: NotificationEvent[];
}

export interface RoleOption {
  value: string;
  label: string;
}

export interface RoleDefaults {
  roles?: RoleOption[];
  role?: string;
  channels: NotificationChannel[];
  channel_labels: Record<string, string>;
  categories: string[];
  events: NotificationEvent[];
}

export interface BroadcastRecord {
  id: number;
  title: string;
  body: string;
  audience_type: 'all' | 'roles' | 'users';
  roles: string[];
  recipient_user_ids: number[];
  channels: string[];
  recipient_count: number;
  sent_by: number | null;
  sent_by_name: string;
  created_at: string;
}

export interface BroadcastPayload {
  title: string;
  body: string;
  audience_type: 'all' | 'roles' | 'users';
  roles?: string[];
  user_ids?: number[];
  channels?: NotificationChannel[];
}

export interface BroadcastRecipientOption {
  id: number;
  full_name: string;
  username: string;
  role: string;
}

export interface BroadcastResult {
  id: number;
  recipient_count: number;
  warnings: string[];
  broadcast: BroadcastRecord;
}

export type OverrideMap = Record<string, Partial<ChannelMap>>;

export interface MyPreferencesUpdate {
  overrides?: OverrideMap;
  muted?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export const notificationService = {
  // Catalog (alert types) tagged for the current user's role.
  getEvents: () => apiClient.get<NotificationCatalog>('/notifications/events/'),

  // In-app feed.
  getFeed: (params?: Record<string, string>) =>
    apiClient.get<FeedResponse>('/notifications/feed/', params),
  getSummary: () => apiClient.get<FeedSummary>('/notifications/feed/summary/'),
  markRead: (id: number) =>
    apiClient.post<{ updated: number }>(`/notifications/feed/${id}/read/`),
  markAllRead: () =>
    apiClient.post<{ updated: number }>('/notifications/feed/read-all/'),

  // Per-user preferences (all roles).
  getMyPreferences: () => apiClient.get<MyPreferences>('/notifications/my-preferences/'),
  updateMyPreferences: (data: MyPreferencesUpdate) =>
    apiClient.put<MyPreferences>('/notifications/my-preferences/', data),

  // Role defaults (admin).
  getRoleDefaults: (role?: string) =>
    apiClient.get<RoleDefaults>('/notifications/role-defaults/', role ? { role } : undefined),
  updateRoleDefaults: (role: string, settings: OverrideMap) =>
    apiClient.put<RoleDefaults>('/notifications/role-defaults/', { role, settings }),

  // Broadcast (admin).
  getBroadcasts: () => apiClient.get<BroadcastRecord[]>('/notifications/broadcast/'),
  // Admin-only, unscoped active-employee list for the broadcast picker (the
  // RBAC-scoped /auth/users/ would return only self for an mdo).
  getBroadcastRecipients: () =>
    apiClient.get<BroadcastRecipientOption[]>('/notifications/broadcast/recipients/'),
  sendBroadcast: (data: BroadcastPayload) =>
    apiClient.post<BroadcastResult>('/notifications/broadcast/', data),
};
