import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createEvent, type EventInput } from '@/lib/events';
import type { Classroom, EventType } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  classrooms: Classroom[];
  canCreateGlobal: boolean;
  initialDate?: Date | null;
}

function toLocalInputValue(d: Date): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

function fromLocalInputValue(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function EventComposer({ open, onClose, onCreated, classrooms, canCreateGlobal, initialDate }: Props) {
  const [type, setType] = useState<EventType>('EVENT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [scope, setScope] = useState<string>(canCreateGlobal ? 'global' : (classrooms[0]?.id ?? ''));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = initialDate ?? new Date();
    base.setMinutes(0, 0, 0);
    if (!initialDate) base.setHours(base.getHours() + 1);
    setType('EVENT');
    setTitle('');
    setDescription('');
    setLocation('');
    setStartsAt(toLocalInputValue(base));
    setEndsAt('');
    setScope(canCreateGlobal ? 'global' : (classrooms[0]?.id ?? ''));
    setError(null);
  }, [open, initialDate, canCreateGlobal, classrooms]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const startsIso = fromLocalInputValue(startsAt);
    if (!startsIso) {
      setError('Start date/time is required.');
      return;
    }
    const endsIso = endsAt ? fromLocalInputValue(endsAt) : null;
    if (endsAt && !endsIso) {
      setError('End date/time is invalid.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (scope !== 'global' && !scope) {
      setError('Pick a class or choose Global.');
      return;
    }
    const payload: EventInput = {
      type,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      startsAt: startsIso,
      endsAt: endsIso,
      classroomId: scope === 'global' ? null : scope,
    };
    setSubmitting(true);
    try {
      await createEvent(payload);
      onCreated();
      onClose();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error?.message ?? err.message)
        : 'Failed to create event';
      setError(typeof msg === 'string' ? msg : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New event" className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="event-type">Type</Label>
            <select
              id="event-type"
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="EVENT">Event</option>
              <option value="CLASS_SESSION">Class session</option>
            </select>
          </div>
          <div>
            <Label htmlFor="event-scope">Visible to</Label>
            <select
              id="event-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {canCreateGlobal && <option value="global">Everyone (global)</option>}
              {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="event-title">Title</Label>
          <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="event-start">Starts</Label>
            <Input id="event-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="event-end">Ends (optional)</Label>
            <Input id="event-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="event-location">Location (optional)</Label>
          <Input id="event-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} placeholder="Room, link, or address" />
        </div>

        <div>
          <Label htmlFor="event-description">Description (optional)</Label>
          <Textarea id="event-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={3} />
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create event'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
