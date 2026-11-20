import Link from "next/link";
import { BookmarkButton } from "@/components/bookmark-button";
import { MeditationCover } from "@/components/meditation-cover";
import { RatingSummary } from "@/components/rating-summary";
import { hasRatings } from "@/lib/meditation/rating-display";
import { canBookmark } from "@/lib/meditation/bookmark-state";
import { metaLine } from "@/lib/meditation/meta";
import type { MeditationWithMeta } from "@/lib/meditation/types";

/** The tag and the length; a shelf is not about when it was made. */
function meta(m: MeditationWithMeta) {
  return metaLine({ tags: m.tags, settings: m.settings });
}

/**
 * One shelf on /discover, Spotify style: a heading over a row of covers that
 * scrolls sideways inside the column, so the page itself never does. On a
 * phone the row runs to the screen edges; the first card still lines up with
 * the heading.
 *
 * The save-for-later control (card ZEN-8) sits on the cover's corner, beside
 * the card's link rather than inside it, so a tap on it never opens the page.
 * A shelf card is too narrow to give it room beside the title.
 */
export function DiscoverRow({
  id,
  title,
  description,
  meditations,
  isSignedIn,
}: {
  id: string;
  title: string;
  description: string;
  meditations: MeditationWithMeta[];
  isSignedIn: boolean;
}) {
  if (meditations.length === 0) return null;

  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="space-y-1">
        <h2 id={id} className="font-serif text-xl font-medium">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {meditations.map((m) => (
          <li key={m.id} className="relative w-36 shrink-0 snap-start sm:w-44">
            <Link
              href={`/meditation/${m.id}`}
              className="group block space-y-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {/* Drawn at the desktop width and scaled down to the phone's. */}
              <MeditationCover
                id={m.id}
                tags={m.tags ?? []}
                title={m.title}
                size={176}
                className="h-auto w-full"
              />
              <div className="space-y-1">
                <p className="line-clamp-2 font-serif text-base font-medium leading-snug group-hover:text-accent-foreground">
                  {m.title}
                </p>
                {(meta(m) || hasRatings(m.rating)) && (
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                    <span className="min-w-0 truncate">{meta(m)}</span>
                    <RatingSummary stats={m.rating} className="shrink-0" />
                  </p>
                )}
              </div>
            </Link>
            {canBookmark(m) && (
              <BookmarkButton
                meditationId={m.id}
                isBookmarked={m.is_bookmarked ?? false}
                isSignedIn={isSignedIn}
                title={m.title}
                variant="cover"
                className="absolute top-1.5 right-1.5"
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
