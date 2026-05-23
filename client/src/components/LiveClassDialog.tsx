import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createEvent, updateEvent, type EventInput } from '@/lib/events';
import type { CalendarEvent, Classroom } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  classrooms: Classroom[];
  initial?: CalendarEvent | null;
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

export function LiveClassDialog({ open, onClose, onSaved, classrooms, initial }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [scope, setScope] = useState<string>('global');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? '');
      setMeetingUrl(initial.meetingUrl ?? '');
      setStartsAt(toLocalInputValue(new Date(initial.startsAt)));
      setEndsAt(initial.endsAt ? toLocalInputValue(new Date(initial.endsAt)) : '');
      setScope(initial.classroomId ?? 'global');
    } else {
      const base = new Date();
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
      setTitle('');
      setDescription('');
      setMeetingUrl('');
      setStartsAt(toLocalInputValue(base));
      setEndsAt('');
      setScope('global');
    }
    setError(null);
  }, [open, initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    const startsIso = fromLocalInputValue(startsAt);
    if (!startsIso) { setError('Start date/time is required.'); return; }
    const endsIso = endsAt ? fromLocalInputValue(endsAt) : null;
    if (endsAt && !endsIso) { setError('End date/time is invalid.'); return; }
    if (!meetingUrl.trim()) { setError('Meeting link is required.'); return; }

    const payload: EventInput = {
      type: 'CLASS_SESSION',
      title: title.trim(),
      description: description.trim() || null,
      meetingUrl: meetingUrl.trim(),
      startsAt: startsIso,
      endsAt: endsIso,
      classroomId: scope === 'global' ? null : scope,
    };

    setSubmitting(true);
    try {
      const saved = initial
        ? await updateEvent(initial.id, payload)
        : await createEvent(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error?.message ?? err.response?.data?.error ?? err.message)
        : 'Failed to save live class';
      setError(typeof msg === 'string' ? msg : 'Failed to save live class');
    } finally {
      setSubmitting(false);
    }
  }

  const isMeetUrl = meetingUrl.includes('meet.google.com');
  const showUrlWarning = meetingUrl.trim().length > 0 && !isMeetUrl && /^https?:\/\//.test(meetingUrl);

  return (
    <Dialog open={open} onClose={onClose} title={initial ? 'Edit live class' : 'Schedule live class'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
        <div>
          <Label htmlFor="lc-title">Title</Label>
          <Input id="lc-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </div>

        <div>
          <Label htmlFor="lc-scope">Visible to</Label>
          <select
            id="lc-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="global">Everyone (global)</option>
            {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="lc-start">Starts</Label>
            <Input id="lc-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="lc-end">Ends (optional)</Label>
            <Input id="lc-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="lc-url">Google Meet URL</Label>
          <Input id="lc-url" type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" required />
          {showUrlWarning && (
            <p className="text-xs text-amber-700 mt-1">This doesn't look like a Google Meet link — make sure it's correct.</p>
          )}
        </div>

        <div>
          <Label htmlFor="lc-desc">Description (optional)</Label>
          <Textarea id="lc-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} rows={3} placeholder="Agenda, topics, prep notes…" />
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : initial ? 'Save changes' : 'Schedule'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
