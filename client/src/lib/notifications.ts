import { api } from './api';
import type { NotificationItem } from './types';

export async function listNotifications(opts: { unread?: boolean; limit?: number } = {}): Promise<NotificationItem[]> {
  const params: Record<string, string | number> = {};
  if (opts.unread) params.unread = '1';
  if (opts.limit) params.limit = opts.limit;
  const { data } = await api.get<{ notifications: NotificationItem[] }>('/notifications', { params });
  return data.notifications;
}

export async function unreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
