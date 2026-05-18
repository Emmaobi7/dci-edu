import { api } from './api';
import type { CalendarEvent, EventType } from './types';

export interface EventInput {
  type?: EventType;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  classroomId?: string | null;
}

export async function listMyEvents(): Promise<CalendarEvent[]> {
  const { data } = await api.get<{ events: CalendarEvent[] }>('/events/me/all');
  return data.events;
}

export async function createEvent(input: EventInput): Promise<CalendarEvent> {
  const { data } = await api.post<{ event: CalendarEvent }>('/events', input);
  return data.event;
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<CalendarEvent> {
  const { data } = await api.patch<{ event: CalendarEvent }>(`/events/${id}`, input);
  return data.event;
}

export async function deleteEvent(id: string): Promise<void> {
  await api.delete(`/events/${id}`);
}
