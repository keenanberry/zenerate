import { useId, type SVGProps } from "react";

// The geometry of src/assets/brand/mark.svg, which is the source: edit there
// and copy across. brand-mark.test.tsx fails if the two drift apart.
export const BRAND_MARK_GEOMETRY = {
  leaf: "M44 2 C47 10 50 20 54 30 C58 38 70 44 78 51 C87 59 89 69 85 76 C81 83 72 86 62 85 C57 84.5 53 83 50 81 C47 83 43 84.5 38 85 C28 86 19 83 15 76 C11 69 13 59 22 51 C30 44 42 38 46 30 C49 22 47 10 44 2 Z",
  stem: "M48.8 82 C49.4 88 49 93 47.2 98 L50.4 98 C52 93 52.2 88 51.4 82 Z",
  veinWidth: 1.9,
  veins: [
    { d: "M50 81 C50 62 50 46 48 30", width: 2.4 },
    { d: "M50 73 C58 73 68 70 75 64 M50 73 C42 73 32 70 25 64" },
    { d: "M50 62 C57 61 64 56 70 50 M50 62 C43 61 36 56 30 50" },
    { d: "M49.6 51 C54 49 57.5 45 60 40 M49.6 51 C45 49 42 45 39.5 40" },
  ] as { d: string; width?: number }[],
};

type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Accessible name. Without one the mark is decorative and hidden from assistive tech. */
  title?: string;
  /**
   * The veins are cut out of the leaf, so the ground shows through them.
   * They blur below about 64px; pass false at nav and favicon sizes, as the
   * raster exports do.
   */
  veins?: boolean;
};

/**
 * The bodhi leaf mark, inline, in currentColor: set its colour with a text
 * token (`text-primary`, `text-foreground`) and its size with `size-*`.
 */
export function BrandMark({ title, veins = true, ...props }: BrandMarkProps) {
  const maskId = `${useId()}brand-mark-veins`;
  const { leaf, stem, veinWidth } = BRAND_MARK_GEOMETRY;

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
      {veins && (
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="white" />
          <g fill="none" stroke="black" strokeWidth={veinWidth} strokeLinecap="round">
            {BRAND_MARK_GEOMETRY.veins.map(({ d, width }) => (
              <path key={d} d={d} strokeWidth={width} />
            ))}
          </g>
        </mask>
      )}
      <path d={leaf} mask={veins ? `url(#${maskId})` : undefined} />
      <path d={stem} />
    </svg>
  );
}
