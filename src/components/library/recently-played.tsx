import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeditationCover } from "@/components/meditation-cover";
import type { RecentlyPlayed as RecentItem } from "@/lib/meditation/library";

/**
 * The Library's Recently played (app shell design, section 2): the caller's
 * latest distinct plays as a cover grid, each tile the cover, the title in
 * Lora and one Dusk line of length and whether it is theirs or from
 * Discover. The tile opens the meditation, where Play is, as the grid view's
 * tiles do on a phone. With nothing played, one prompt to make a first
 * meditation or browse Discover takes its place.
 */
export function RecentlyPlayed({ items }: { items: RecentItem[] }) {
  return (
    <section aria-labelledby="recently-played-title" className="space-y-6">
      <h2 id="recently-played-title" className="font-serif text-xl font-medium tracking-tight">
        Recently played
      </h2>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-16 text-center">
          <p className="max-w-[40ch] text-muted-foreground">
            Nothing played yet. Make your first meditation, or find one on Discover.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="sm" className="gap-2">
              <Link href="/create">
                <Plus aria-hidden className="size-4" />
                Create a meditation
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/discover">Browse Discover</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
          {items.map((m) => (
            <li key={m.id}>
              <RecentTile item={m} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentTile({ item }: { item: RecentItem }) {
  const minutes = item.settings?.duration;
  const meta = [minutes && `${minutes} min`, item.source === "yours" ? "Yours" : "Discover"]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/meditation/${item.id}`}
      className="group block space-y-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {/* Drawn at the column's widest and scaled to fit it, as MeditationCard does. */}
      <MeditationCover
        id={item.id}
        tags={item.tags ?? []}
        title={item.title}
        size={240}
        coverUrl={item.cover_url}
        className="h-auto w-full motion-safe:transition-opacity group-hover:opacity-90"
      />
      <span className="block space-y-1">
        <span className="line-clamp-2 font-serif text-base leading-snug font-medium group-hover:text-accent-foreground">
          {item.title}
        </span>
        <span className="block truncate text-sm text-muted-foreground tabular-nums">{meta}</span>
      </span>
    </Link>
  );
}
