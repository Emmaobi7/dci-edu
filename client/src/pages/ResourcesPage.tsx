import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  FileText,
  Library,
  Link as LinkIcon,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import {
  deleteResource,
  deleteResourceAttachment,
  listResources,
  resourceAttachmentDownloadUrl,
  type Resource,
  type ResourceAttachment,
} from '@/lib/resources';
import { ResourceDialog } from '@/components/ResourceDialog';
import { ResourceAttachDialog } from '@/components/ResourceAttachDialog';

export function ResourcesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  const [resources, setResources] = useState<Resource[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [editTarget, setEditTarget] = useState<Resource | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [attachTarget, setAttachTarget] = useState<Resource | null>(null);

  async function reload() {
    try {
      const { resources: rows, categories: cats } = await listResources();
      setResources(rows);
      setCategories(cats);
      setError(null);
    } catch {
      setError('Could not load resources');
    }
  }

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!resources) return [];
    const needle = q.trim().toLowerCase();
    return resources.filter((r) => {
      if (activeCategory !== 'all' && (r.category ?? '') !== activeCategory) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        (r.description?.toLowerCase().includes(needle) ?? false) ||
        (r.category?.toLowerCase().includes(needle) ?? false) ||
        r.createdBy.name.toLowerCase().includes(needle)
      );
    });
  }, [resources, q, activeCategory]);

  async function onDelete(r: Resource) {
    if (!window.confirm(`Delete resource "${r.title}"? Attachments will be permanently removed.`)) return;
    try {
      await deleteResource(r.id);
      setResources((rows) => (rows ?? []).filter((x) => x.id !== r.id));
    } catch {
      setError('Could not delete resource');
    }
  }

  async function onRemoveAttachment(resourceId: string, attachmentId: string) {
    if (!window.confirm('Remove this attachment?')) return;
    try {
      await deleteResourceAttachment(attachmentId);
      setResources((rows) =>
        (rows ?? []).map((r) =>
          r.id === resourceId
            ? { ...r, attachments: r.attachments.filter((a) => a.id !== attachmentId) }
            : r,
        ),
      );
    } catch {
      setError('Could not remove attachment');
    }
  }

  function onSaved(saved: Resource) {
    setResources((rows) => {
      const list = rows ?? [];
      const exists = list.some((r) => r.id === saved.id);
      return exists ? list.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...list];
    });
    setCreateOpen(false);
    setEditTarget(null);
    if (!resources?.some((r) => r.id === saved.id)) {
      setAttachTarget(saved);
    }
  }

  function onAttachmentsAdded(resourceId: string, added: ResourceAttachment[]) {
    setResources((rows) =>
      (rows ?? []).map((r) =>
        r.id === resourceId ? { ...r, attachments: [...r.attachments, ...added] } : r,
      ),
    );
    setAttachTarget((cur) =>
      cur && cur.id === resourceId ? { ...cur, attachments: [...cur.attachments, ...added] } : cur,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center">
            <Library className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
            <p className="text-sm text-muted-foreground">
              Reading materials, references, and downloads shared by faculty.
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New resource
          </Button>
        )}
      </div>

      <Card className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, description, or creator"
              className="pl-9"
            />
          </div>
          {(categories.length > 0 || activeCategory !== 'all') && (
            <div className="-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center gap-1.5 px-1">
                <FilterPill active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
                  All
                </FilterPill>
                {categories.map((c) => (
                  <FilterPill key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)}>
                    {c}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
      </Card>

      {!resources && !error && (
        <div className="text-sm text-muted-foreground">Loading resources…</div>
      )}
      {resources && filtered.length === 0 && (
        <Card className="text-center py-12">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-brand/15 text-brand grid place-items-center mb-3">
            <Library className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">
            {q || activeCategory !== 'all' ? 'No resources match' : 'No resources yet'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {canManage
              ? 'Tap "New resource" to share lecture notes, YouTube explainers, or external reading.'
              : 'Faculty will add reading materials and references here.'}
          </p>
        </Card>
      )}

      {resources && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              canManage={canManage && (isAdmin || user?.id === r.createdById)}
              onEdit={() => setEditTarget(r)}
              onDelete={() => onDelete(r)}
              onAttach={() => setAttachTarget(r)}
              onRemoveAttachment={(attId) => onRemoveAttachment(r.id, attId)}
            />
          ))}
        </div>
      )}

      <ResourceDialog
        open={createOpen || !!editTarget}
        initial={editTarget}
        categories={categories}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        onSaved={onSaved}
      />
      <ResourceAttachDialog
        open={!!attachTarget}
        resource={attachTarget}
        onClose={() => { setAttachTarget(null); reload(); }}
        onAdded={(added) => attachTarget && onAttachmentsAdded(attachTarget.id, added)}
      />
    </div>
  );
}

function FilterPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ' +
        (active
          ? 'bg-brand text-white border-brand'
          : 'bg-white/60 border-white/70 hover:bg-white/80')
      }
    >
      {children}
    </button>
  );
}

interface ResourceCardProps {
  resource: Resource;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAttach: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
}

function ResourceCard({
  resource, canManage, onEdit, onDelete, onAttach, onRemoveAttachment,
}: ResourceCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {resource.category && (
            <span className="inline-block rounded-full bg-brand/15 text-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-1.5">
              {resource.category}
            </span>
          )}
          <h3 className="font-semibold leading-tight">{resource.title}</h3>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/60 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/15 hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {resource.description && (
        <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">
          {resource.description}
        </p>
      )}

      {resource.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {resource.attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              attachment={a}
              canManage={canManage}
              onRemove={() => onRemoveAttachment(a.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span className="truncate">
          By {resource.createdBy.name} · {new Date(resource.createdAt).toLocaleDateString()}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={onAttach}
            className="inline-flex items-center gap-1 rounded-lg border border-white/70 bg-white/60 px-2 py-1 text-xs font-medium text-foreground hover:bg-white/90 transition-colors"
          >
            <Paperclip className="h-3.5 w-3.5" /> Attach
          </button>
        )}
      </div>
    </Card>
  );
}

function AttachmentChip({
  attachment, canManage, onRemove,
}: { attachment: ResourceAttachment; canManage: boolean; onRemove: () => void }) {
  const { Icon, label, href, tone } = attachmentMeta(attachment);
  return (
    <span className={`group inline-flex items-center gap-1 rounded-full ${tone} px-2 py-1 text-xs font-medium max-w-full`}>
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 min-w-0"
        title={label}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate max-w-[12rem]">{label}</span>
      </a>
      {canManage && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove attachment"
          className="ml-1 inline-flex items-center justify-center rounded-full p-0.5 opacity-60 hover:opacity-100 hover:bg-black/10"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function attachmentMeta(a: ResourceAttachment): {
  Icon: React.ComponentType<{ className?: string }>; label: string; href: string; tone: string;
} {
  if (a.kind === 'DOCUMENT') {
    return {
      Icon: FileText,
      label: a.filename ?? 'Document',
      href: resourceAttachmentDownloadUrl(a.id),
      tone: 'bg-sky-500/15 text-sky-700',
    };
  }
  if (a.kind === 'YOUTUBE') {
    return {
      Icon: Video,
      label: a.title?.trim() || 'YouTube video',
      href: a.youtubeUrl ?? (a.youtubeId ? `https://www.youtube.com/watch?v=${a.youtubeId}` : '#'),
      tone: 'bg-rose-500/15 text-rose-700',
    };
  }
  if (a.kind === 'LINK') {
    return {
      Icon: ExternalLink,
      label: a.title?.trim() || a.host || a.url || 'Link',
      href: a.url ?? '#',
      tone: 'bg-violet-500/15 text-violet-700',
    };
  }
  return {
    Icon: LinkIcon,
    label: a.filename ?? 'Attachment',
    href: '#',
    tone: 'bg-muted text-muted-foreground',
  };
}