import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createResource, updateResource, type Resource } from '@/lib/resources';

interface ResourceDialogProps {
  open: boolean;
  initial?: Resource | null;
  categories: string[];
  onClose: () => void;
  onSaved: (resource: Resource) => void;
}

export function ResourceDialog({ open, initial, categories, onClose, onSaved }: ResourceDialogProps) {
  const editing = !!initial;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setCategory(initial?.category ?? '');
    setError(null);
  }, [open, initial]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true); setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
      };
      const result = editing
        ? await updateResource(initial!.id, {
            title: payload.title,
            description: payload.description ?? null,
            category: payload.category ?? null,
          })
        : await createResource(payload);
      onSaved(result);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error ?? 'Could not save');
      } else {
        setError('Could not save');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Edit resource' : 'New resource'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="res-title">Title</Label>
          <Input
            id="res-title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Algebra revision notes"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="res-desc">Description</Label>
          <Textarea
            id="res-desc"
            maxLength={4000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief context students should know."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="res-cat">Category</Label>
          <Input
            id="res-cat"
            maxLength={80}
            list="res-cat-options"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Lecture notes, Past papers"
          />
          <datalist id="res-cat-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            Optional. Used to group resources. Pick an existing one or type a new label.
          </p>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create resource'}
          </Button>
        </div>
        {!editing && (
          <p className="text-xs text-muted-foreground">
            You'll be able to attach files, YouTube links, or web links right after creating.
          </p>
        )}
      </form>
    </Dialog>
  );
}
