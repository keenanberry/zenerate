import Link from "next/link";
import { Bookmark, ChevronRight, Heart, ListMusic, Sparkles, type LucideIcon } from "lucide-react";
import type { LibraryCounts } from "@/lib/meditation/library";

const PLACES: { key: keyof LibraryCounts; href: string; label: string; icon: LucideIcon }[] = [
  { key: "favorites", href: "/library/favorites", label: "Favorites", icon: Heart },
  { key: "bookmarks", href: "/library/bookmarks", label: "Bookmarks", icon: Bookmark },
  { key: "meditations", href: "/library/meditations", label: "My meditations", icon: Sparkles },
  { key: "collections", href: "/library/collections", label: "Collections", icon: ListMusic },
];

/**
 * The Library's list of places (app shell design, section 2), as Apple
 * Music's: a Primary icon, the label, the count in Dusk and a chevron, one
 * 52px row each between Hairline dividers. Every row shows, a count of 0
 * included; a count that could not be read is left out rather than shown as 0.
 */
export function LibraryRows({ counts }: { counts: LibraryCounts }) {
  return (
    <nav aria-label="Library">
      <ul className="divide-y border-y">
        {PLACES.map(({ key, href, label, icon: Icon }) => {
          const count = counts[key];
          return (
            <li key={key}>
              <Link
                href={href}
                className="group flex min-h-13 items-center gap-4 rounded-md px-1 outline-none hover:bg-card-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
              >
                <Icon aria-hidden className="size-5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-base">{label}</span>
                {count !== null && (
                  <span className="text-sm text-muted-foreground tabular-nums">{count}</span>
                )}
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground motion-safe:transition-colors"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
