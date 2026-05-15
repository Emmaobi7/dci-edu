import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { announcementImageUrl } from '@/lib/announcements';
import type { AnnouncementAttachment } from '@/lib/types';
import { YouTubeEmbed } from './YouTubeEmbed';

export function AnnouncementMedia({ attachments }: { attachments: AnnouncementAttachment[] }) {
  const images = attachments.filter((a) => a.kind === 'IMAGE');
  const videos = attachments.filter((a) => a.kind === 'YOUTUBE' && a.youtubeId);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  if (images.length === 0 && videos.length === 0) return null;

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
