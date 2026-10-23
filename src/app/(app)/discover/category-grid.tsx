import Link from "next/link";
import { MeditationCover, coverDesign } from "@/components/meditation-cover";
import { DISCOVER_CATEGORIES } from "@/lib/meditation/tags";
import { discoverHref } from "@/lib/meditation/discover";

/*
 * Each category is drawn in the cover system (task 49): its first tag's
 * field fills the tile, and a cover for the category sits cropped into the
 * right edge, so Discover's tiles and its meditations speak one language.
 * The label sits on plain field, clear of the motif. The cover's left edge
 * fades in through an alpha mask, so a horizon band never ends in a hard
 * edge mid-tile; it sets only alpha, so it is not a gradient (DESIGN.md).
 */
export function CategoryGrid() {
  return (
    <section aria-labelledby="browse-heading" className="space-y-4">
      <h2 id="browse-heading" className="font-serif text-xl font-medium">
        Browse by feeling
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {DISCOVER_CATEGORIES.map((category) => {
          const id = `category:${category.slug}`;
          const tags = category.tags.slice(0, 1);
          const { fieldKey } = coverDesign(id, tags);
          return (
            <li key={category.slug}>
              <Link
                href={discoverHref({}, { category: category.slug })}
                style={{ backgroundColor: `var(--cover-field-${fieldKey})` }}
                className="group relative flex h-24 overflow-hidden rounded-xl p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-28"
              >
                <span className="relative z-10 max-w-[60%] font-serif text-base font-medium leading-snug sm:text-lg">
                  {category.label}
                </span>
                <MeditationCover
                  id={id}
                  tags={tags}
                  title={category.label}
                  size={112}
                  className="absolute top-0 -right-6 h-full w-auto rounded-none [mask-image:linear-gradient(to_right,transparent,black_45%)] motion-safe:transition-opacity group-hover:opacity-85"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
