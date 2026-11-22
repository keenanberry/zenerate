"use client";

import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { coverMiddle, coverThumb, MIDDLE_MAX_SIZE, THUMB_MAX_SIZE } from "@/lib/cover/url";

type CoverImageProps = {
  /** The generated cover's public URL (src/lib/cover/url.ts). */
  src: string;
  /** Edge length in px it is drawn at; picks the thumbnail or the full image. */
  size: number;
  /** "" where the cover sits beside its title, the title where it stands alone. */
  alt: string;
  /** On the frame: the cover's radius and any size or placement the caller sets. */
  className: string;
  /** The designed cover, shown instead whenever the photo cannot be. */
  fallback: ReactNode;
  /** Load it eagerly with high priority: only for an above-the-fold LCP image. */
  preload?: boolean;
  /** Told once the photo has failed and the fallback shows. */
  onFailed?: () => void;
};

/**
 * The files a cover is drawn from, in the order to try them: the smallest
 * stored size that is sharp at 2x, then each larger one, so a size a cover
 * was stored without (covers made before thumbnails, or before the middle
 * size) falls through to the next. Up to THUMB_MAX_SIZE the 256px
 * thumbnail, up to MIDDLE_MAX_SIZE the 512px middle size, larger the full
 * image alone.
 */
export function coverSources(src: string, size: number): string[] {
  if (size <= THUMB_MAX_SIZE) return [coverThumb(src), coverMiddle(src), src];
  if (size <= MIDDLE_MAX_SIZE) return [coverMiddle(src), src];
  return [src];
}

/**
 * A generated cover photo, for MeditationCover. A client component for its
 * load and error states. Until the photo's bytes arrive its square holds a
 * quiet Hush tile, and the photo fades in over it once loaded (at once
 * under reduced motion). A file that 404s or fails to decode moves on to the
 * next source, and after the last one the designed cover shows, never a
 * broken-image box. next/image replays a load or an error that happened
 * before hydration, so a cached photo still shows and a photo that failed
 * during the server render still falls back.
 */
export function CoverImage(props: CoverImageProps) {
  // Keyed by URL, so a new cover starts again from its first source.
  const [failed, setFailed] = useState<{ src: string; count: number } | null>(null);
  const failures = failed?.src === props.src ? failed.count : 0;
  const sources = coverSources(props.src, props.size);
  const current = sources[failures];
  // Keyed by the file, so a source that falls through starts on the tile.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  return (
    <CoverImageView
      {...props}
      failures={failures}
      // The page's LCP cover is not held back for hydration.
      loaded={props.preload === true || loadedSrc === current}
      onLoad={() => setLoadedSrc(current)}
      onError={() => {
        setFailed({ src: props.src, count: failures + 1 });
        if (failures + 1 >= sources.length) props.onFailed?.();
      }}
    />
  );
}

/**
 * CoverImage's markup after `failures` sources have failed, before and
 * after the current one has `loaded`; exported for its tests. The caller's
 * classes go on the frame, which reserves the square (`--cover-size`, or
 * the caller's own width and height), so nothing shifts when the photo
 * arrives.
 */
export function CoverImageView({
  src,
  size,
  alt,
  className,
  fallback,
  preload,
  failures,
  loaded,
  onLoad,
  onError,
}: CoverImageProps & { failures: number; loaded: boolean; onLoad: () => void; onError: () => void }) {
  const current = coverSources(src, size)[failures];
  if (!current) return fallback;
  return (
    <span
      data-loaded={loaded || undefined}
      style={{ "--cover-size": `${size}px` } as CSSProperties}
      className={cn(
        "relative inline-block aspect-square h-(--cover-size) w-(--cover-size) overflow-hidden bg-muted",
        className,
      )}
    >
      <Image
        // A new source is a new element, so its load and error are its own.
        key={current}
        src={current}
        width={size}
        height={size}
        alt={alt}
        preload={preload}
        onLoad={onLoad}
        onError={onError}
        className={cn(
          "absolute inset-0 size-full object-cover motion-safe:transition-opacity motion-safe:duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
        // Served as stored: the stored sizes are already the sizes a cover
        // needs, and Vercel's Image Optimization quota on Hobby
        // (about 5,000 a month) would run out within a few hundred covers.
        unoptimized
      />
    </span>
  );
}
