import { useState } from 'react';
import { Play } from 'lucide-react';

/**
 * Lite YouTube facade — shows the thumbnail until clicked, then swaps in the
 * iframe with autoplay. Keeps the feed snappy even with many embeds per card.
 */
export function YouTubeEmbed({ youtubeId, title }: { youtubeId: string; title?: string | null }) {
  const [active, setActive] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black/80 aspect-video">
      {active ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title ?? 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 h-full w-full"
          aria-label="Play video"
        >
          <img
            src={thumb}
            alt={title ?? 'Video thumbnail'}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/20 group-hover:bg-black/10 transition-colors">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-glass-lg">
              <Play className="h-6 w-6 translate-x-[1px]" fill="currentColor" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
