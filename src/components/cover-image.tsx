"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type CoverImageProps = {
  /** The generated cover's public URL (src/lib/cover/url.ts). */
  src: string;
  /** Edge length in px it is drawn at; next/image serves it at 1x and 2x of this. */
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
 * A generated cover photo, for MeditationCover. A client component only for
 * its error state: a cover that 404s or fails to decode shows the designed
 * cover instead, never a broken-image box. next/image replays an error that
 * happened before hydration, so a photo that failed during the server render
 * still falls back.
 */
export function CoverImage(props: CoverImageProps) {
  // Keyed by URL, so a new cover gets a fresh try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <CoverImageView
      {...props}
      failed={failedSrc === props.src}
      onError={() => {
        setFailedSrc(props.src);
        props.onFailed?.();
      }}
    />
  );
}

/** CoverImage's markup for a given state; exported for the fallback's test. */
export function CoverImageView({
  src,
  size,
  alt,
  className,
  fallback,
  preload,
  failed,
  onError,
}: CoverImageProps & { failed: boolean; onError: () => void }) {
  if (failed) return fallback;
  return (
    <Image
      src={src}
      width={size}
      height={size}
      alt={alt}
      preload={preload}
      onError={onError}
      className={className}
    />
  );
}
