import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { announcementFileUrl, announcementImageUrl } from '@/lib/announcements';
import type { AnnouncementAttachment } from '@/lib/types';
import { YouTubeEmbed } from './YouTubeEmbed';

function formatBytes(size: number | null | undefined): string | null {
  if (!size || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AnnouncementMedia({ attachments }: { attachments: AnnouncementAttachment[] }) {
  const images = attachments.filter((a) => a.kind === 'IMAGE');
  const videos = attachments.filter((a) => a.kind === 'YOUTUBE' && a.youtubeId);
  const documents = attachments.filter((a) => a.kind === 'DOCUMENT');
  const links = attachments.filter((a) => a.kind === 'LINK' && a.url);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (images.length === 0 && videos.length === 0 && documents.length === 0 && links.length === 0) {
    return null;
  }

  const gridCls =
    images.length === 1 ? 'grid-cols-1'
      : images.length === 2 ? 'grid-cols-2'
        : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className="flex flex-col gap-3">
      {images.length > 0 && (
        <div className={`grid gap-2 ${gridCls}`}>
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightbox(i)}
              className="block overflow-hidden rounded-xl bg-black/5 aspect-[4/3] group"
            >
              <img
                src={announcementImageUrl(img.id)}
                alt={img.filename ?? 'Image'}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="flex flex-col gap-2">
          {videos.map((v) => (
            <YouTubeEmbed key={v.id} youtubeId={v.youtubeId as string} title={v.youtubeUrl} />
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {documents.map((d) => {
            const sizeLabel = formatBytes(d.size);
            return (
              <li key={d.id}>
                <a
                  href={announcementFileUrl(d.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/60 backdrop-blur-md px-3 py-2 text-sm hover:bg-white/80 transition-colors"
                >
                  <span className="h-9 w-9 rounded-lg bg-brand/15 text-brand grid place-items-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{d.filename ?? 'Document'}</span>
                    <span className="block text-xs text-muted-foreground">
                      {sizeLabel ? `${sizeLabel} · ` : ''}Click to download
                    </span>
                  </span>
                  <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {links.map((l) => {
            const url = l.url ?? '';
            const headline = l.title?.trim() || l.host || url;
            const sub = l.title?.trim() ? (l.host ?? url) : url;
            return (
              <li key={l.id}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/60 backdrop-blur-md px-3 py-2 text-sm hover:bg-white/80 transition-colors"
                >
                  <span className="h-9 w-9 rounded-lg bg-brand/15 text-brand grid place-items-center shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{headline}</span>
                    {sub && sub !== headline && (
                      <span className="block text-xs text-muted-foreground truncate">{sub}</span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {lightbox !== null && images[lightbox] && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={announcementImageUrl(images[lightbox].id)}
            alt={images[lightbox].filename ?? 'Image'}
            className="max-h-[90vh] max-w-[95vw] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
