import { BRAND_MARK_GEOMETRY } from "@/components/brand-mark";
import { TAG_GROUPS, type TagGroup } from "@/lib/meditation/tags";
import { cn } from "@/lib/utils";

/**
 * A designed cover for a meditation, until generated artwork ships
 * (tasks/post-ship/generated-cover-art.md). DESIGN.md's Covers section is the
 * rule: flat tone fields in theme tokens, no gradient, no glow.
 *
 * Everything is derived from the data: the first tag's group picks the hues,
 * and a hash of the id picks the motif and its composition. The same
 * meditation draws the same cover on every render and every device, and the
 * markup holds no colour values, so a theme toggle recolours it through the
 * tokens.
 */

/** Text-token classes; the cover paints in currentColor at low opacity. */
const GROUP_HUES: Record<TagGroup | "none", readonly [string, string]> = {
  themes: ["text-primary", "text-periwinkle"],
  practices: ["text-sage", "text-periwinkle"],
  moments: ["text-candle", "text-primary"],
  none: ["text-muted-foreground", "text-muted-foreground"],
};

const MOTIFS = ["moon", "ripples", "strata", "lotus", "orbit"] as const;
export type CoverMotif = (typeof MOTIFS)[number];

/** FNV-1a, 32-bit. Stable across engines, which is all a cover needs. */
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a seeded sequence in [0, 1), so one hash yields many choices. */
function sequence(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tagGroupOf(tag: string | undefined): TagGroup | "none" {
  if (!tag) return "none";
  for (const group of Object.keys(TAG_GROUPS) as TagGroup[]) {
    if ((TAG_GROUPS[group] as readonly string[]).includes(tag)) return group;
  }
  return "none";
}

/** One decimal place keeps the markup short and identical everywhere. */
const r1 = (n: number) => Math.round(n * 10) / 10;

export type CoverDesign = {
  motif: CoverMotif;
  group: TagGroup | "none";
  hues: readonly [string, string];
  seed: number;
};

export function coverDesign(id: string, tags: readonly string[]): CoverDesign {
  const seed = hashId(id);
  const group = tagGroupOf(tags[0]);
  const [a, b] = GROUP_HUES[group];
  return {
    motif: MOTIFS[seed % MOTIFS.length],
    group,
    // Which of the group's two hues leads is the hash's call too.
    hues: (seed >>> 8) & 1 ? [b, a] : [a, b],
    seed,
  };
}

type MeditationCoverProps = {
  id: string;
  tags: readonly string[];
  title: string;
  /** Edge length in px, 48 (track rows) to 320 (page header). */
  size: number;
  className?: string;
  /**
   * Covers sit beside their title, so by default they are decorative. Pass
   * false where the cover stands alone and should be named by the title.
   */
  decorative?: boolean;
};

export function MeditationCover({
  id,
  tags,
  title,
  size,
  className,
  decorative = true,
}: MeditationCoverProps) {
  const { motif, hues, seed } = coverDesign(id, tags);
  const [lead, second] = hues;
  // Strokes hold a steady weight on screen: about 1.25px in a row, 2px in a
  // header, whatever the scale of the 100-unit box.
  const stroke = r1(((size <= 64 ? 1.25 : size <= 160 ? 1.5 : 2) * 100) / size);
  // Small covers drop the finest detail so the lines never close up.
  const small = size < 96;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      data-motif={motif}
      className={cn(
        "shrink-0 overflow-hidden border border-border/60 bg-cover-ground",
        size < 96 ? "rounded-md" : "rounded-xl",
        className,
      )}
    >
      {motif === "moon" && <Moon seed={seed} lead={lead} second={second} />}
      {motif === "ripples" && (
        <Ripples seed={seed} lead={lead} second={second} stroke={stroke} small={small} />
      )}
      {motif === "strata" && <Strata seed={seed} lead={lead} second={second} />}
      {motif === "lotus" && (
        <Lotus seed={seed} lead={lead} second={second} stroke={stroke} />
      )}
      {motif === "orbit" && (
        <Orbit seed={seed} lead={lead} second={second} stroke={stroke} small={small} />
      )}
    </svg>
  );
}

// Each motif seeds its own sequence: a shared one would be consumed twice
// when React renders a component twice (Strict Mode), and the server and
// client markup would disagree.
type MotifProps = { seed: number; lead: string; second: string };
type StrokedProps = MotifProps & { stroke: number; small?: boolean };

/** A low moon over two bands of horizon. */
function Moon({ seed, lead, second }: MotifProps) {
  const rand = sequence(seed);
  const horizon = r1(58 + rand() * 16);
  const cx = r1(22 + rand() * 56);
  const cy = r1(horizon - 16 - rand() * 14);
  const radius = r1(9 + rand() * 9);
  const swell = r1(4 + rand() * 8);
  return (
    <>
      <circle className={second} fill="currentColor" fillOpacity={0.55} cx={cx} cy={cy} r={radius} />
      <g className={lead} fill="currentColor">
        <rect y={horizon} width={100} height={100 - horizon} fillOpacity={0.18} />
        <path
          d={`M0 ${r1(horizon + 14)} Q50 ${r1(horizon + 14 - swell)} 100 ${r1(horizon + 10)} V100 H0 Z`}
          fillOpacity={0.24}
        />
      </g>
    </>
  );
}

/** Rings spreading from a point near one edge, as on still water. */
function Ripples({ seed, lead, second, stroke, small }: StrokedProps) {
  const rand = sequence(seed);
  const cx = r1(15 + rand() * 70);
  const cy = r1(rand() < 0.5 ? 20 + rand() * 20 : 60 + rand() * 20);
  const step = r1(small ? 16 + rand() * 4 : 10 + rand() * 6);
  const count = small ? 4 : 7;
  return (
    <>
      <g className={lead} fill="none" stroke="currentColor" strokeWidth={stroke}>
        {Array.from({ length: count }, (_, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r1(step * (i + 1))}
            strokeOpacity={r1(0.6 - (i * 0.45) / count)}
          />
        ))}
      </g>
      <circle className={second} fill="currentColor" fillOpacity={0.6} cx={cx} cy={cy} r={r1(step * 0.4)} />
    </>
  );
}

/** Three hills of dusk, deepening toward the foreground, under a small star. */
function Strata({ seed, lead, second }: MotifProps) {
  const rand = sequence(seed);
  const layers = [0.12, 0.18, 0.26].map((opacity, i) => {
    const base = 46 + i * 16 + rand() * 6;
    const peak = r1(10 + rand() * 80);
    const lift = r1(base - 8 - rand() * 12);
    return { opacity, d: `M0 ${r1(base)} Q${peak} ${lift} 100 ${r1(base - 4 + rand() * 8)} V100 H0 Z` };
  });
  return (
    <>
      <circle
        className={second}
        fill="currentColor"
        fillOpacity={0.6}
        cx={r1(18 + rand() * 64)}
        cy={r1(16 + rand() * 14)}
        r={r1(3 + rand() * 3)}
      />
      <g className={lead} fill="currentColor">
        {layers.map((layer) => (
          <path key={layer.d} d={layer.d} fillOpacity={layer.opacity} />
        ))}
      </g>
    </>
  );
}

/** The lotus mark, large and cropped, in the lead hue over a quiet ground. */
function Lotus({ seed, lead, second, stroke }: StrokedProps) {
  const rand = sequence(seed);
  const { petals, base } = BRAND_MARK_GEOMETRY;
  const scale = r1(1.15 + rand() * 0.35);
  const dx = r1(50 - 50 * scale + (rand() - 0.5) * 24);
  const dy = r1(100 - 86 * scale + rand() * 10);
  return (
    <>
      <rect className={second} fill="currentColor" fillOpacity={0.12} y={r1(dy + 74 * scale)} width={100} height={100} />
      <g
        className={lead}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={r1(stroke / scale)}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${dx} ${dy}) scale(${scale})`}
      >
        {petals.map((d) => (
          <path key={d} d={d} />
        ))}
        <path d={base} />
      </g>
    </>
  );
}

/** A large body half out of frame, crossed by a moon's path. */
function Orbit({ seed, lead, second, stroke, small }: StrokedProps) {
  const rand = sequence(seed);
  const left = rand() < 0.5;
  const cx = r1(left ? -10 + rand() * 20 : 90 + rand() * 20);
  const cy = r1(70 + rand() * 30);
  const radius = r1(48 + rand() * 14);
  const orbit = r1(radius + 14 + rand() * 6);
  const angle = (left ? -60 : -120) + (rand() - 0.5) * 30;
  const mx = r1(cx + orbit * Math.cos((angle * Math.PI) / 180));
  const my = r1(cy + orbit * Math.sin((angle * Math.PI) / 180));
  return (
    <>
      <circle className={lead} fill="currentColor" fillOpacity={0.24} cx={cx} cy={cy} r={radius} />
      <g className={second} fill="none" stroke="currentColor" strokeWidth={stroke} strokeOpacity={0.4}>
        <circle cx={cx} cy={cy} r={orbit} />
        {!small && <circle cx={cx} cy={cy} r={r1(orbit + 12)} strokeOpacity={0.2} />}
      </g>
      <circle className={second} fill="currentColor" fillOpacity={0.7} cx={mx} cy={my} r={small ? 5 : 4} />
    </>
  );
}
