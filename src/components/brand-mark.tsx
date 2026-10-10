import type { SVGProps } from "react";

// The geometry of src/assets/brand/mark.svg, which is the source: edit there
// and copy across. brand-mark.test.tsx fails if the two drift apart.
export const BRAND_MARK_GEOMETRY = {
  petals: [
    "M50 74 C40 62 36 40 50 16 C64 40 60 62 50 74 Z",
    "M50 74 C38 70 24 56 21 32",
    "M21 32 C30 42 38 46 41 49.5",
    "M50 74 C62 70 76 56 79 32",
    "M79 32 C70 42 62 46 59 49.5",
    "M50 74 C36 76 16 70 6 52",
    "M6 52 C16 56 28 60 33.8 62.5",
    "M50 74 C64 76 84 70 94 52",
    "M94 52 C84 56 72 60 66.2 62.5",
  ],
  base: "M12 80 C26 94 74 94 88 80",
  dots: [
    { cx: 50, cy: 6, r: 3.2 },
    { cx: 23, cy: 17, r: 2.7 },
    { cx: 77, cy: 17, r: 2.7 },
  ],
  strokeWidth: 5,
  boldStrokeWidth: 8.5,
};

type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Accessible name. Without one the mark is decorative and hidden from assistive tech. */
  title?: string;
  /**
   * Below about 32px the lines close up, so the bold tier draws the petals
   * alone at a heavier stroke and leaves out the base and the dots. Pass it at
   * nav and favicon sizes, as the raster exports do.
   */
  bold?: boolean;
};

/**
 * The lotus mark, inline, in currentColor: set its colour with a text token
 * (`text-primary`, `text-foreground`) and its size with `size-*`.
 */
export function BrandMark({ title, bold = false, ...props }: BrandMarkProps) {
  const { petals, base, dots, strokeWidth, boldStrokeWidth } = BRAND_MARK_GEOMETRY;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title && <title>{title}</title>}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={bold ? boldStrokeWidth : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // The petals alone sit high in the box; dropping them centres their ink.
        transform={bold ? "translate(0 5)" : undefined}
      >
        {petals.map((d) => (
          <path key={d} d={d} />
        ))}
        {!bold && <path d={base} />}
      </g>
      {!bold &&
        dots.map(({ cx, cy, r }) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} />)}
    </svg>
  );
}
