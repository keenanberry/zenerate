import Image from "next/image";
import Link from "next/link";
import { MeditationCover, coverDesign } from "@/components/meditation-cover";
import { DISCOVER_CATEGORIES, type DiscoverCategory } from "@/lib/meditation/tags";
import { discoverHref } from "@/lib/meditation/discover";

/*
 * Each category is a fixed photograph in public/discover/categories/<slug>.webp
 * (640px square WebP), filling its tile like a category on a music app. The
 * label sits top-left over a Deep Night scrim that fades out from that
 * corner through an alpha mask, the session player's precedent: it sets only
 * alpha, so it adds no hue and is not a gradient (DESIGN.md, Covers).
 *
 * The scrim is sized in rem, like the label, not in percent of the tile, so
 * a narrow tile cannot pull the fade in under a label that stays the same
 * size. The label keeps to one line (16px until md, where four columns are
 * wide enough for 18px), so its whole block lies on the scrim's plateau: 70%
 * alpha or more behind every label pixel, which holds Moonlit at 4.5:1 over
 * the white sky of `stress-relief` at every width. DESIGN.md has the measured
 * numbers; a longer label needs them rechecked. Past the label it clears toward
 * the lower right, where the subjects are. The label stays light in both
 * themes: it is on a photo.
 *
 * `objectPosition` is the crop of the square photo into the wide tile, set
 * per image by eye so its subject survives. A category not listed here draws
 * the designed tile it had before, until a photo is added.
 */
export const CATEGORY_IMAGES: Record<string, { objectPosition: string }> = {
  sleep: { objectPosition: "50% 65%" },
  "stress-relief": { objectPosition: "50% 50%" },
  focus: { objectPosition: "50% 50%" },
  morning: { objectPosition: "50% 75%" },
  kindness: { objectPosition: "50% 50%" },
  "breath-and-body": { objectPosition: "50% 60%" },
};

/** The public path of a category's photo, or null when it has none yet. */
export function categoryImagePath(slug: string): string | null {
  return Object.hasOwn(CATEGORY_IMAGES, slug) ? `/discover/categories/${slug}.webp` : null;
}

const TILE =
  "group relative flex h-24 overflow-hidden rounded-xl p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-28";

export function CategoryTile({
  category,
  eager = false,
}: {
  category: DiscoverCategory;
  /** Load the photo eagerly: only the first two, the first row on a phone. */
  eager?: boolean;
}) {
  const href = discoverHref({}, { category: category.slug });
  const src = categoryImagePath(category.slug);

  if (!src) return <DesignedTile category={category} href={href} />;

  return (
    <Link href={href} className={`${TILE} bg-night`}>
      <Image
        src={src}
        width={640}
        height={640}
        alt=""
        loading={eager ? "eager" : "lazy"}
        style={{ objectPosition: CATEGORY_IMAGES[category.slug].objectPosition }}
        className="absolute inset-0 size-full object-cover motion-safe:transition-opacity group-hover:opacity-85"
        // A fixed asset served as stored from the CDN, so it spends no
        // Image Optimization quota.
        unoptimized
      />
      <div
        aria-hidden
        data-scrim
        className="absolute inset-0 bg-night [mask-image:radial-gradient(ellipse_15rem_5.5rem_at_0_0,rgb(0_0_0/0.8),rgb(0_0_0/0.7)_75%,transparent)]"
      />
      {/* `dark` gives the label Moonlit in either theme: it sits on a photo. */}
      <span className="dark relative font-serif text-base font-medium leading-snug whitespace-nowrap text-foreground md:text-lg">
        {category.label}
      </span>
    </Link>
  );
}

/*
 * The designed tile, for a category without a photo: its first tag's field
 * fills the tile, and a cover for the category sits cropped into the right
 * edge, faded in through an alpha mask (task 49).
 */
function DesignedTile({ category, href }: { category: DiscoverCategory; href: string }) {
  const id = `category:${category.slug}`;
  const tags = category.tags.slice(0, 1);
  const { fieldKey } = coverDesign(id, tags);
  return (
    <Link
      href={href}
      style={{ backgroundColor: `var(--cover-field-${fieldKey})` }}
      className={TILE}
    >
      <span className="relative z-10 max-w-[60%] font-serif text-base font-medium leading-snug md:text-lg">
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
  );
}

export function CategoryGrid() {
  return (
    <section aria-labelledby="browse-heading" className="space-y-4">
      <h2 id="browse-heading" className="font-serif text-xl font-medium">
        Browse by feeling
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {DISCOVER_CATEGORIES.map((category, i) => (
          <li key={category.slug}>
            {/* Two columns on a phone, four from sm. Eager for the first two,
                the first row at either width; the rest load lazily. */}
            <CategoryTile category={category} eager={i < 2} />
          </li>
        ))}
      </ul>
    </section>
  );
}
