import { BRAND_MARK_GEOMETRY } from "@/components/brand-mark";
import { isTag, type Tag } from "@/lib/meditation/tags";
import { cn } from "@/lib/utils";

/**
 * A designed cover for a meditation, until generated artwork ships
 * (tasks/post-ship/generated-cover-art.md). DESIGN.md's Covers section is the
 * rule: flat tone fields in theme tokens, no gradient, no glow. Since task 49
 * the lead hue fills the frame as a field and the motif draws boldly on it,
 * as album art does, rather than as faint lines on the page's dark.
 *
 * Everything is derived from the data: the first tag picks a pair of hues,
 * and a hash of the id picks the motif (leaning toward one that suits one of
 * the tags) and its composition. The same meditation draws the same cover on
 * every render and every device, and the markup holds no colour values, so a
 * theme toggle recolours it through the tokens.
 */

/** Text-token classes; the cover paints in currentColor at low opacity. */
const HUES = {
  amethyst: "text-primary",
  periwinkle: "text-periwinkle",
  sage: "text-sage",
  candle: "text-candle",
  rose: "text-cover-rose",
  clay: "text-cover-clay",
  moss: "text-cover-moss",
  tide: "text-cover-tide",
  mist: "text-cover-mist",
  heather: "text-cover-heather",
} as const;
export type CoverHue = keyof typeof HUES;

/** The field each hue paints the whole frame with (`--cover-field-*`). */
const FIELDS: Record<CoverHue | "quiet", string> = {
  amethyst: "text-cover-field-amethyst",
  periwinkle: "text-cover-field-periwinkle",
  sage: "text-cover-field-sage",
  candle: "text-cover-field-candle",
  rose: "text-cover-field-rose",
  clay: "text-cover-field-clay",
  moss: "text-cover-field-moss",
  tide: "text-cover-field-tide",
  mist: "text-cover-field-mist",
  heather: "text-cover-field-heather",
  quiet: "text-cover-field-quiet",
};

/**
 * The motifs were drawn for a dark ground at 12–60% opacity. On a field of
 * their own hue they need more weight to read, so every opacity is scaled.
 */
const BOOST = 2.4;
const boost = (opacity: number) => r1(Math.min(0.95, opacity * BOOST) * 100) / 100;

/** Each tag's pair, lead first. No two tags share a pair, in either order. */
export const TAG_HUES: Record<Tag, readonly [CoverHue, CoverHue]> = {
  "stress-relief": ["sage", "mist"],
  anxiety: ["tide", "periwinkle"],
  sleep: ["periwinkle", "amethyst"],
  focus: ["mist", "candle"],
  gratitude: ["candle", "rose"],
  "self-compassion": ["rose", "heather"],
  confidence: ["clay", "candle"],
  "letting-go": ["heather", "mist"],
  grief: ["mist", "amethyst"],
  energy: ["candle", "moss"],
  creativity: ["heather", "candle"],
  "inner-peace": ["amethyst", "sage"],
  breathwork: ["tide", "mist"],
  "body-scan": ["clay", "rose"],
  visualization: ["amethyst", "tide"],
  "loving-kindness": ["rose", "amethyst"],
  mantra: ["heather", "amethyst"],
  "open-awareness": ["mist", "periwinkle"],
  "progressive-relaxation": ["periwinkle", "sage"],
  grounding: ["moss", "clay"],
  affirmations: ["candle", "amethyst"],
  morning: ["rose", "mist"],
  "midday-reset": ["sage", "candle"],
  "after-work": ["clay", "heather"],
  bedtime: ["periwinkle", "heather"],
  "rough-day": ["moss", "mist"],
  "before-a-big-moment": ["clay", "amethyst"],
  "short-break": ["tide", "sage"],
};

const QUIET = ["text-muted-foreground", "text-muted-foreground"] as const;

export const MOTIFS = [
  "moon",
  "ripples",
  "strata",
  "lotus",
  "orbit",
  "dunes",
  "waves",
  "ridge",
  "starfield",
  "rain",
  "leaves",
  "stones",
  "aurora",
  "arch",
] as const;
export type CoverMotif = (typeof MOTIFS)[number];

/** The motifs drawn around a circle. They stay a minority of the set. */
export const ROUND_MOTIFS: readonly CoverMotif[] = ["moon", "ripples", "lotus", "orbit"];

/**
 * Motifs that suit a tag. A cover leans toward these two times in three and
 * otherwise draws any motif, so a tag never owns a single picture.
 */
const TAG_MOTIFS: Partial<Record<Tag, readonly CoverMotif[]>> = {
  sleep: ["moon", "starfield", "orbit"],
  bedtime: ["starfield", "moon", "aurora"],
  grounding: ["stones", "ridge", "strata"],
  "rough-day": ["rain", "stones"],
  breathwork: ["waves", "ripples"],
  anxiety: ["waves", "ripples"],
  "stress-relief": ["rain", "waves", "dunes"],
  "progressive-relaxation": ["dunes", "waves"],
  "body-scan": ["strata", "dunes"],
  focus: ["arch", "ridge"],
  confidence: ["ridge", "arch"],
  affirmations: ["arch", "ridge"],
  "before-a-big-moment": ["ridge", "arch"],
  gratitude: ["leaves", "lotus"],
  "self-compassion": ["lotus", "leaves"],
  "loving-kindness": ["lotus", "leaves"],
  "letting-go": ["leaves", "rain", "dunes"],
  grief: ["rain", "moon"],
  energy: ["aurora", "ridge"],
  creativity: ["aurora", "leaves"],
  visualization: ["arch", "aurora", "orbit"],
  "inner-peace": ["lotus", "ripples", "dunes"],
  mantra: ["ripples", "orbit"],
  "open-awareness": ["starfield", "dunes"],
  morning: ["dunes", "strata", "leaves"],
  "midday-reset": ["rain", "waves"],
  "after-work": ["dunes", "moon"],
  "short-break": ["ripples", "leaves"],
};

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

/** One decimal place keeps the markup short and identical everywhere. */
const r1 = (n: number) => Math.round(n * 10) / 10;

export type CoverDesign = {
  motif: CoverMotif;
  /** The tag that picked the hues, or null when no tag is in the vocabulary. */
  tag: Tag | null;
  hues: readonly [string, string];
  /** The field under the motif: the lead hue's, or a quiet one. */
  field: string;
  /** The field's token, `var(--cover-field-<key>)`, for a surface around a cover. */
  fieldKey: CoverHue | "quiet";
  /** Drawn left-to-right reversed, so one motif faces both ways. */
  mirrored: boolean;
  seed: number;
};

export function coverDesign(id: string, tags: readonly string[]): CoverDesign {
  const seed = hashId(id);
  // Each choice reads its own bits of the hash, so they vary independently.
  const pick = sequence(seed ^ 0x9e3779b9);
  const known = tags.filter(isTag);
  const tag = known[0] ?? null;
  const pair = tag ? TAG_HUES[tag] : null;
  const [a, b] = pair ? pair.map((hue) => HUES[hue]) : QUIET;
  const swapped = ((seed >>> 8) & 1) === 1;
  // The motif leans toward one of the tags, not always the first, so the
  // pictures do not simply follow the palette.
  const leaning = known.length ? TAG_MOTIFS[known[Math.floor(pick() * known.length)]] : undefined;
  const lean = pick() < 2 / 3;
  const any = MOTIFS[seed % MOTIFS.length];
  const motif = leaning && lean ? leaning[Math.floor(pick() * leaning.length)] : any;
  return {
    motif,
    tag,
    // Which of the pair leads is the hash's call too.
    hues: swapped ? [b, a] : [a, b],
    field: FIELDS[pair ? pair[swapped ? 1 : 0] : "quiet"],
    fieldKey: pair ? pair[swapped ? 1 : 0] : "quiet",
    mirrored: ((seed >>> 9) & 1) === 1,
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
  /**
   * Fill a box that is not square, cropping the picture to it (a half of a
   * collection's artwork). Off, the cover keeps its square.
   */
  crop?: boolean;
};

export function MeditationCover({
  id,
  tags,
  title,
  size,
  className,
  decorative = true,
  crop = false,
}: MeditationCoverProps) {
  const { motif, hues, field, mirrored, seed } = coverDesign(id, tags);
  const [lead, second] = hues;
  // Strokes hold a steady, bold weight on screen: 2px in a row, 3px in a
  // header, whatever the scale of the 100-unit box.
  const stroke = r1(((size <= 64 ? 2 : size <= 160 ? 2.5 : 3) * 100) / size);
  // Small covers drop the finest detail so the lines never close up.
  const small = size < 96;
  const props = { seed, lead, second, stroke, small, o: boost };
  const Motif = MOTIF_COMPONENTS[motif];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      preserveAspectRatio={crop ? "xMidYMid slice" : undefined}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      data-motif={motif}
      className={cn(
        "shrink-0 overflow-hidden",
        size < 96 ? "rounded-md" : "rounded-xl",
        className,
      )}
    >
      <rect className={field} fill="currentColor" width={100} height={100} />
      <g transform={mirrored ? "matrix(-1 0 0 1 100 0)" : undefined}>
        <Motif {...props} />
      </g>
    </svg>
  );
}

// Each motif seeds its own sequence: a shared one would be consumed twice
// when React renders a component twice (Strict Mode), and the server and
// client markup would disagree.
type MotifProps = { seed: number; lead: string; second: string; o: (opacity: number) => number };
type StrokedProps = MotifProps & { stroke: number; small: boolean };

/** A low moon over two bands of horizon. */
function Moon({ seed, o, lead, second }: MotifProps) {
  const rand = sequence(seed);
  const horizon = r1(58 + rand() * 16);
  const cx = r1(22 + rand() * 56);
  const cy = r1(horizon - 16 - rand() * 14);
  const radius = r1(9 + rand() * 9);
  const swell = r1(4 + rand() * 8);
  return (
    <>
      <circle className={second} fill="currentColor" fillOpacity={o(0.55)} cx={cx} cy={cy} r={radius} />
      <g className={lead} fill="currentColor">
        <rect y={horizon} width={100} height={100 - horizon} fillOpacity={o(0.18)} />
        <path
          d={`M0 ${r1(horizon + 14)} Q50 ${r1(horizon + 14 - swell)} 100 ${r1(horizon + 10)} V100 H0 Z`}
          fillOpacity={o(0.24)}
        />
      </g>
    </>
  );
}

/** Rings spreading from a point near one edge, as on still water. */
function Ripples({ seed, o, lead, second, stroke, small }: StrokedProps) {
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
            strokeOpacity={o(r1(0.6 - (i * 0.45) / count))}
          />
        ))}
      </g>
      <circle className={second} fill="currentColor" fillOpacity={o(0.6)} cx={cx} cy={cy} r={r1(step * 0.4)} />
    </>
  );
}

/** Three hills of dusk, deepening toward the foreground, under a small star. */
function Strata({ seed, o, lead, second }: MotifProps) {
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
        fillOpacity={o(0.6)}
        cx={r1(18 + rand() * 64)}
        cy={r1(16 + rand() * 14)}
        r={r1(3 + rand() * 3)}
      />
      <g className={lead} fill="currentColor">
        {layers.map((layer) => (
          <path key={layer.d} d={layer.d} fillOpacity={o(layer.opacity)} />
        ))}
      </g>
    </>
  );
}

/** The lotus mark, large and cropped, in the lead hue over a quiet ground. */
function Lotus({ seed, o, lead, second, stroke }: StrokedProps) {
  const rand = sequence(seed);
  const { petals, base } = BRAND_MARK_GEOMETRY;
  const scale = r1(1.15 + rand() * 0.35);
  const dx = r1(50 - 50 * scale + (rand() - 0.5) * 24);
  const dy = r1(100 - 86 * scale + rand() * 10);
  return (
    <>
      <rect className={second} fill="currentColor" fillOpacity={o(0.12)} y={r1(dy + 74 * scale)} width={100} height={100} />
      <g
        className={lead}
        fill="none"
        stroke="currentColor"
        strokeOpacity={o(0.55)}
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
function Orbit({ seed, o, lead, second, stroke, small }: StrokedProps) {
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
      <circle className={lead} fill="currentColor" fillOpacity={o(0.24)} cx={cx} cy={cy} r={radius} />
      <g className={second} fill="none" stroke="currentColor" strokeWidth={stroke} strokeOpacity={o(0.4)}>
        <circle cx={cx} cy={cy} r={orbit} />
        {!small && <circle cx={cx} cy={cy} r={r1(orbit + 12)} strokeOpacity={o(0.2)} />}
      </g>
      <circle className={second} fill="currentColor" fillOpacity={o(0.7)} cx={mx} cy={my} r={small ? 5 : 4} />
    </>
  );
}

/** Dunes in layers, each crest a sharp lee edge, deepening toward the front. */
function Dunes({ seed, o, lead, second, small }: StrokedProps) {
  const rand = sequence(seed);
  const count = small ? 3 : 4 + Math.floor(rand() * 3);
  const top = 30 + rand() * 16;
  const span = (92 - top) / count;
  const layers = Array.from({ length: count }, (_, i) => {
    const base = top + i * span + rand() * 4;
    const crest = 15 + rand() * 70;
    const lift = 6 + rand() * 10;
    const d =
      `M0 ${r1(base)} Q${r1(crest * 0.6)} ${r1(base - lift * 0.4)} ${r1(crest)} ${r1(base - lift)}` +
      ` Q${r1(crest + (100 - crest) * 0.25)} ${r1(base - lift * 0.1)} 100 ${r1(base + 2 + rand() * 6)} V100 H0 Z`;
    return { d, front: i === count - 1, opacity: r1(0.12 + (i * 0.16) / count) };
  });
  return (
    <>
      {layers.map((layer, i) => (
        <path
          key={i}
          className={i % 2 && !layer.front ? second : lead}
          fill="currentColor"
          fillOpacity={o(layer.opacity)}
          d={layer.d}
        />
      ))}
    </>
  );
}

/** Tide lines across the lower water, closer and stronger toward the shore. */
function Waves({ seed, o, lead, second, stroke, small }: StrokedProps) {
  const rand = sequence(seed);
  const count = small ? 4 : 6 + Math.floor(rand() * 4);
  const top = 22 + rand() * 24;
  const gap = (96 - top) / count;
  const length = small ? 30 + rand() * 10 : 16 + rand() * 16;
  const amp = (small ? 3 : 1.5) + rand() * 2.5;
  const drift = rand() * length;
  const lines = Array.from({ length: count }, (_, i) => {
    const y = r1(top + gap * (i + 0.5));
    const x0 = r1(-length + ((i * drift) % length));
    let d = `M${x0} ${y} Q${r1(x0 + length / 4)} ${r1(y - amp)} ${r1(x0 + length / 2)} ${y}`;
    for (let x = x0 + length; x < 112; x += length / 2) d += ` T${r1(x)} ${y}`;
    return { d, accent: i % 3 === 1, opacity: r1(0.25 + (i * 0.35) / count) };
  });
  return (
    <>
      <rect className={second} fill="currentColor" fillOpacity={o(0.1)} y={r1(top)} width={100} height={100} />
      <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
        {lines.map((line, i) => (
          <path
            key={i}
            className={line.accent ? second : lead}
            strokeOpacity={o(line.opacity)}
            d={line.d}
          />
        ))}
      </g>
    </>
  );
}

/** Mountain ridges, a pale far range behind a darker near one. */
function Ridge({ seed, o, lead, second, small }: StrokedProps) {
  const rand = sequence(seed);
  const count = small ? 2 : 2 + Math.floor(rand() * 2);
  const ranges = Array.from({ length: count }, (_, j) => {
    const base = 52 + j * (small ? 18 : 14) + rand() * 6;
    const step = small ? 20 + rand() * 6 : 13 + rand() * 9;
    let d = `M-5 ${r1(base)}`;
    for (let x = -5 + step, i = 0; x < 110; x += step, i++) {
      const height = i % 2 === 0 ? 6 + rand() * (j === 0 ? 24 : 14) : rand() * 8;
      d += ` L${r1(x)} ${r1(base - height)}`;
    }
    return { d: `${d} V100 H-5 Z`, front: j === count - 1, opacity: r1(0.16 + j * 0.1) };
  });
  return (
    <>
      {ranges.map((range, i) => (
        <path
          key={i}
          className={range.front ? lead : second}
          fill="currentColor"
          fillOpacity={o(range.opacity)}
          strokeLinejoin="round"
          d={range.d}
        />
      ))}
    </>
  );
}

/** A field of stars over a low horizon, a few joined into a constellation. */
function Starfield({ seed, o, lead, second, stroke, small }: StrokedProps) {
  const rand = sequence(seed);
  const horizon = r1(78 + rand() * 12);
  const count = small ? 10 + Math.floor(rand() * 5) : 26 + Math.floor(rand() * 28);
  const stars = Array.from({ length: count }, (_, i) => ({
    key: i,
    cx: r1(3 + rand() * 94),
    cy: r1(3 + rand() * (horizon - 8)),
    r: r1(small ? 1.8 + rand() * 1.2 : 0.6 + rand() * 1.1),
    bright: rand() < 0.15,
    opacity: r1(0.3 + rand() * 0.35),
  }));
  const bright = stars.filter((star) => star.bright).slice(0, 4);
  return (
    <>
      <rect className={lead} fill="currentColor" fillOpacity={o(0.2)} y={horizon} width={100} height={100} />
      {!small && bright.length > 2 && (
        <polyline
          className={second}
          fill="none"
          stroke="currentColor"
          strokeWidth={r1(stroke * 0.6)}
          strokeOpacity={o(0.3)}
          points={bright.map((star) => `${star.cx},${star.cy}`).join(" ")}
        />
      )}
      {stars.map((star) => (
        <circle
          key={star.key}
          className={star.bright ? second : lead}
          fill="currentColor"
          fillOpacity={o(star.bright ? 0.75 : star.opacity)}
          cx={star.cx}
          cy={star.cy}
          r={star.bright ? r1(star.r + 0.6) : star.r}
        />
      ))}
    </>
  );
}

/** Rain in slanted strokes over a still pool. */
function Rain({ seed, o, lead, second, stroke, small }: StrokedProps) {
  const rand = sequence(seed);
  const pool = r1(82 + rand() * 8);
  const slant = r1((rand() - 0.5) * 28);
  const columns = small ? 7 : 12 + Math.floor(rand() * 8);
  const width = 120 / columns;
  const drops = Array.from({ length: columns }, (_, i) => {
    const x = -10 + (i + 0.2 + rand() * 0.6) * width;
    return Array.from({ length: small ? 2 : 2 + Math.floor(rand() * 3) }, () => {
      const y = -10 + rand() * (pool + 5);
      const length = (small ? 14 : 10) + rand() * 14;
      return { x: r1(x), y: r1(y), y2: r1(Math.min(y + length, pool - 2)), accent: rand() < 0.2 };
    });
  }).flat();
  return (
    <>
      <rect className={second} fill="currentColor" fillOpacity={o(0.18)} y={pool} width={100} height={100} />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(${slant} 50 50)`}
      >
        {drops
          .filter((drop) => drop.y2 > drop.y)
          .map((drop, i) => (
            <line
              key={i}
              className={drop.accent ? second : lead}
              strokeOpacity={o(drop.accent ? 0.6 : 0.4)}
              x1={drop.x}
              y1={drop.y}
              x2={drop.x}
              y2={drop.y2}
            />
          ))}
      </g>
    </>
  );
}

/** A frond rising from the lower edge, its leaves alternating side to side. */
function Leaves({ seed, o, lead, second, stroke, small }: StrokedProps) {
  const rand = sequence(seed);
  const fronds = small || rand() < 0.5 ? 1 : 2;
  return (
    <>
      {Array.from({ length: fronds }, (_, f) => {
        const back = f === 0 && fronds === 2;
        const x0 = 25 + rand() * 50;
        const tip = { x: x0 + (rand() - 0.5) * 50, y: 10 + rand() * 22 };
        const bend = { x: x0 + (rand() - 0.5) * 60, y: 55 + rand() * 15 };
        const count = small ? 4 : 6 + Math.floor(rand() * 4);
        const leaves = Array.from({ length: count }, (_, i) => {
          const t = 0.2 + (i * 0.75) / count;
          const u = 1 - t;
          const x = u * u * x0 + 2 * u * t * bend.x + t * t * tip.x;
          const y = u * u * 105 + 2 * u * t * bend.y + t * t * tip.y;
          const heading =
            (Math.atan2(2 * u * (bend.y - 105) + 2 * t * (tip.y - bend.y), 2 * u * (bend.x - x0) + 2 * t * (tip.x - bend.x)) *
              180) /
            Math.PI;
          const side = i % 2 ? 1 : -1;
          const length = (small ? 30 : 28) * (1 - t * 0.5);
          const angle = r1(heading + 90 + side * (40 + rand() * 20));
          return { x: r1(x), y: r1(y), angle, length: r1(length), width: r1(length * 0.42) };
        });
        return (
          <g key={f} className={back ? second : lead} fill="currentColor" fillOpacity={o(back ? 0.18 : 0.32)}>
            <path
              fill="none"
              stroke="currentColor"
              strokeOpacity={o(back ? 0.25 : 0.45)}
              strokeWidth={stroke}
              strokeLinecap="round"
              d={`M${r1(x0)} 105 Q${r1(bend.x)} ${r1(bend.y)} ${r1(tip.x)} ${r1(tip.y)}`}
            />
            {leaves.map((leaf, i) => (
              <path
                key={i}
                className={!back && i % 3 === 2 ? second : undefined}
                transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle})`}
                d={`M0 0 Q${leaf.width} ${r1(-leaf.length / 2)} 0 ${-leaf.length} Q${-leaf.width} ${r1(-leaf.length / 2)} 0 0 Z`}
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

/** A cairn of flat stones on level ground. */
function Stones({ seed, o, lead, second, small }: StrokedProps) {
  const rand = sequence(seed);
  const ground = r1(82 + rand() * 8);
  const count = small ? 3 : 3 + Math.floor(rand() * 3);
  const stones: { cx: number; cy: number; rx: number; ry: number }[] = [];
  let x = 30 + rand() * 40;
  let top = ground + 2;
  let rx = 22 + rand() * 10;
  for (let i = 0; i < count; i++) {
    if (i > 0) {
      rx *= 0.7 + rand() * 0.15;
      x += (rand() - 0.5) * 6;
    }
    const ry = rx * (0.36 + rand() * 0.14);
    const cy = top - ry + 1;
    top = cy - ry;
    stones.push({ cx: r1(x), cy: r1(cy), rx: r1(rx), ry: r1(ry) });
  }
  return (
    <>
      <rect className={lead} fill="currentColor" fillOpacity={o(0.14)} y={ground} width={100} height={100} />
      {stones.map((stone, i) => (
        <ellipse
          key={i}
          className={i === count - 1 ? second : lead}
          fill="currentColor"
          fillOpacity={o(i === count - 1 ? 0.5 : r1(0.22 + (i % 2) * 0.12))}
          {...stone}
        />
      ))}
    </>
  );
}

/** Aurora curtains as stepped columns of flat tone over a dark horizon. */
function Aurora({ seed, o, lead, second, small }: StrokedProps) {
  const rand = sequence(seed);
  const count = small ? 2 : 3 + Math.floor(rand() * 2);
  const horizon = r1(80 + rand() * 10);
  const step = small ? 12.5 : 7 + rand() * 5;
  const curtains = Array.from({ length: count }, (_, j) => {
    const base = 14 + j * (40 / count) + rand() * 8;
    const amp = 6 + rand() * 12;
    const frequency = 0.03 + rand() * 0.05;
    const phase = rand() * Math.PI * 2;
    const height = 14 + rand() * 18;
    let d = "";
    for (let x = 0; x < 100; x += step) {
      const y = base + amp * Math.sin(x * frequency + phase);
      d += `M${r1(x)} ${r1(y)}h${r1(step)}v${r1(height)}h${r1(-step)}Z`;
    }
    return { d, opacity: r1(0.12 + (j % 2) * 0.06) };
  });
  return (
    <>
      {curtains.map((curtain, j) => (
        <path
          key={j}
          className={j % 2 ? second : lead}
          fill="currentColor"
          fillOpacity={o(curtain.opacity)}
          d={curtain.d}
        />
      ))}
      <rect className={lead} fill="currentColor" fillOpacity={o(0.24)} y={horizon} width={100} height={100} />
    </>
  );
}

/** A doorway with its arch traced inward, on a floor of tone. */
function Arch({ seed, o, lead, second, stroke, small }: StrokedProps) {
  const rand = sequence(seed);
  const floor = r1(80 + rand() * 10);
  const width = small ? 44 + rand() * 12 : 30 + rand() * 24;
  const left = 50 - width / 2 + (rand() - 0.5) * (100 - width - 16);
  const spring = 26 + rand() * 22;
  const rings = small ? 1 : 2 + Math.floor(rand() * 2);
  const inset = 4 + rand() * 3;
  const door = (i: number) => {
    const x = left + i * inset;
    const w = width - 2 * i * inset;
    return `M${r1(x)} ${floor} V${r1(spring + i * inset)} A${r1(w / 2)} ${r1(w / 2)} 0 0 1 ${r1(x + w)} ${r1(spring + i * inset)} V${floor}`;
  };
  return (
    <>
      <path className={second} fill="currentColor" fillOpacity={o(0.16)} d={`${door(0)} Z`} />
      <rect className={lead} fill="currentColor" fillOpacity={o(0.22)} y={floor} width={100} height={100} />
      <g className={lead} fill="none" stroke="currentColor" strokeWidth={stroke}>
        {Array.from({ length: rings }, (_, i) => (
          <path key={i} strokeOpacity={o(r1(0.5 - i * 0.12))} d={door(i + 1)} />
        ))}
      </g>
    </>
  );
}

const MOTIF_COMPONENTS: Record<CoverMotif, (props: StrokedProps) => React.ReactNode> = {
  moon: Moon,
  ripples: Ripples,
  strata: Strata,
  lotus: Lotus,
  orbit: Orbit,
  dunes: Dunes,
  waves: Waves,
  ridge: Ridge,
  starfield: Starfield,
  rain: Rain,
  leaves: Leaves,
  stones: Stones,
  aurora: Aurora,
  arch: Arch,
};
