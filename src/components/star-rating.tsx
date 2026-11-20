"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

const SIZES = {
  // The prompt's: 48px targets, as large as a thumb wants after a session.
  lg: { button: "size-12", icon: "size-9" },
  // The meditation page's: 40px targets in a quiet row.
  md: { button: "size-10", icon: "size-6" },
};

/**
 * Five stars to tap, one button each, so Tab reaches every star and Enter or
 * Space chooses it. The chosen one is pressed; under the pointer, the stars
 * up to it light as a preview.
 */
export function StarRating({
  value,
  onRate,
  label,
  size = "md",
  disabled = false,
  className,
}: {
  value: number | null;
  onRate: (stars: number) => void;
  /** The group's accessible name, e.g. "Rate Evening Calm". */
  label: string;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  className?: string;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const lit = preview ?? value ?? 0;
  const s = SIZES[size];

  return (
    <div
      role="group"
      aria-label={label}
      onMouseLeave={() => setPreview(null)}
      className={cn("flex items-center", className)}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          aria-pressed={value === n}
          disabled={disabled}
          onClick={() => onRate(n)}
          onMouseEnter={() => setPreview(n)}
          className={cn(
            "flex items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60 motion-safe:transition-transform motion-safe:active:scale-90",
            s.button,
          )}
        >
          <Star
            aria-hidden
            strokeWidth={1.5}
            className={cn(
              s.icon,
              "motion-safe:transition-colors",
              n <= lit ? "fill-current text-primary" : "text-muted-foreground/70",
            )}
          />
        </button>
      ))}
    </div>
  );
}
