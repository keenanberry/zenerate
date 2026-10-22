import Link from "next/link";
import {
  Feather,
  Heart,
  Moon,
  Mountain,
  Sprout,
  Sunrise,
  Target,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { DISCOVER_CATEGORIES } from "@/lib/meditation/tags";
import { discoverHref } from "@/lib/meditation/discover";
import { cn } from "@/lib/utils";

/*
 * Each card takes a tint of one of the four tertiary-or-primary tokens. They
 * are laid out so no two neighbours share a tone in the 2-column phone grid
 * or the 4-column desktop one. Full class strings, so Tailwind sees them.
 */
const TONES = {
  periwinkle: "bg-periwinkle/15 hover:bg-periwinkle/25 [&_svg]:text-periwinkle",
  sage: "bg-sage/15 hover:bg-sage/25 [&_svg]:text-sage",
  primary: "bg-primary/15 hover:bg-primary/25 [&_svg]:text-primary",
  candle: "bg-candle/15 hover:bg-candle/25 [&_svg]:text-candle",
} as const;

const LOOK: Record<string, { icon: LucideIcon; tone: keyof typeof TONES }> = {
  sleep: { icon: Moon, tone: "periwinkle" },
  "stress-relief": { icon: Sprout, tone: "sage" },
  focus: { icon: Target, tone: "primary" },
  morning: { icon: Sunrise, tone: "candle" },
  kindness: { icon: Heart, tone: "candle" },
  "breath-and-body": { icon: Wind, tone: "primary" },
  confidence: { icon: Mountain, tone: "sage" },
  "letting-go": { icon: Feather, tone: "periwinkle" },
};

export function CategoryGrid() {
  return (
    <section aria-labelledby="browse-heading" className="space-y-4">
      <h2 id="browse-heading" className="font-serif text-xl font-medium">
        Browse by feeling
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {DISCOVER_CATEGORIES.map((category) => {
          const look = LOOK[category.slug] ?? { icon: Feather, tone: "primary" };
          const Icon = look.icon;
          return (
            <li key={category.slug}>
              <Link
                href={discoverHref({}, { category: category.slug })}
                className={cn(
                  "relative flex h-24 overflow-hidden rounded-xl border p-4 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors sm:h-28",
                  TONES[look.tone],
                )}
              >
                <span className="font-serif text-base font-medium leading-snug sm:text-lg">
                  {category.label}
                </span>
                <Icon
                  aria-hidden
                  className="absolute -right-1 -bottom-1 size-12 rotate-12 opacity-80 sm:size-14"
                  strokeWidth={1.5}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
