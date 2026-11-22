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
 * alpha, so it adds no hue and is not a gradient (DESIGN.md, Covers). It
 * holds at 75% or more behind the label, which keeps Moonlit at 4.5:1 over
 * the white sky of `stress-relief`, and clears toward the lower right, where
 * the subjects are. The label stays light in both themes: it is on a photo.
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
  return slug in CATEGORY_IMAGES ? `/discover/categories/${slug}.webp` : null;
}

const TILE =
  "group relative flex h-24 overflow-hidden rounded-xl p-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:h-28";

export function CategoryTile({
  category,
  eager = false,
}: {
  category: DiscoverCategory;
  /** Load the photo eagerly: only the first row, which is above the fold. */
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
        className="absolute inset-0 bg-night [mask-image:radial-gradient(ellipse_130%_90%_at_0_0,rgb(0_0_0/0.85),rgb(0_0_0/0.75)_60%,transparent)]"
      />
      {/* `dark` gives the label Moonlit in either theme: it sits on a photo. */}
      <span className="dark relative max-w-[85%] font-serif text-base font-medium leading-snug text-foreground sm:text-lg">
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
            {/* Four columns from sm, two below: the first four cover the
                first row at either width. */}
            <CategoryTile category={category} eager={i < 4} />
          </li>
        ))}
      </ul>
    </section>
  );
}
