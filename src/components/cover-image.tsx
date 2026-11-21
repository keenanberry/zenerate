"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { coverThumb, THUMB_MAX_SIZE } from "@/lib/cover/url";

type CoverImageProps = {
  /** The generated cover's public URL (src/lib/cover/url.ts). */
  src: string;
  /** Edge length in px it is drawn at; picks the thumbnail or the full image. */
  size: number;
  /** "" where the cover sits beside its title, the title where it stands alone. */
  alt: string;
  className: string;
  /** The designed cover, shown instead whenever the photo cannot be. */
  fallback: ReactNode;
  /** Load it eagerly with high priority: only for an above-the-fold LCP image. */
  preload?: boolean;
  /** Told once the photo has failed and the fallback shows. */
  onFailed?: () => void;
};

/**
 * The files a cover is drawn from, in the order to try them. Up to
 * THUMB_MAX_SIZE it is the 256px thumbnail, then the full image (a cover
 * stored before thumbnails existed has none); larger, the full image alone.
 */
export function coverSources(src: string, size: number): string[] {
  return size <= THUMB_MAX_SIZE ? [coverThumb(src), src] : [src];
}

/**
 * A generated cover photo, for MeditationCover. A client component only for
 * its error state: a file that 404s or fails to decode moves on to the next
 * source, and after the last one the designed cover shows, never a
 * broken-image box. next/image replays an error that happened before
 * hydration, so a photo that failed during the server render still falls
 * back.
 */
export function CoverImage(props: CoverImageProps) {
  // Keyed by URL, so a new cover starts again from its first source.
  const [failed, setFailed] = useState<{ src: string; count: number } | null>(null);
  const failures = failed?.src === props.src ? failed.count : 0;
  const sources = coverSources(props.src, props.size).length;
  return (
    <CoverImageView
      {...props}
      failures={failures}
      onError={() => {
        setFailed({ src: props.src, count: failures + 1 });
        if (failures + 1 >= sources) props.onFailed?.();
      }}
    />
  );
}

/** CoverImage's markup after `failures` sources have failed; exported for its tests. */
export function CoverImageView({
  src,
  size,
  alt,
  className,
  fallback,
  preload,
  failures,
  onError,
}: CoverImageProps & { failures: number; onError: () => void }) {
  const current = coverSources(src, size)[failures];
  if (!current) return fallback;
  return (
    <Image
      // A new source is a new element, so its error is its own.
      key={current}
      src={current}
      width={size}
      height={size}
      alt={alt}
      preload={preload}
      onError={onError}
      className={className}
      // Served as stored: the thumbnail and the full image are already the
      // sizes a cover needs, and Vercel's Image Optimization quota on Hobby
      // (about 5,000 a month) would run out within a few hundred covers.
      unoptimized
    />
  );
}
