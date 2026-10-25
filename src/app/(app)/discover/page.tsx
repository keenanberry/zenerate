import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getPickedForYou,
  getPopularMeditations,
  getPublicMeditations,
} from "@/lib/meditation/actions";
import {
  DURATION_BUCKETS,
  TYPE_LABELS,
  discoverHref,
  getCategory,
  hasActiveFilters,
  parseDiscoverFilters,
  type DiscoverFilters,
} from "@/lib/meditation/discover";
import { TAG_LABELS } from "@/lib/meditation/tags";
import { pageMetadata } from "@/lib/seo/metadata";
import { MeditationListView } from "@/components/meditation-list-view";
import { DiscoverViewWrapper } from "./view-wrapper";
import { DiscoverSearch } from "./search";
import { CategoryGrid } from "./category-grid";
import { DiscoverRow } from "./discover-row";
import { X } from "lucide-react";

export const metadata = pageMetadata({
  title: "Discover | Zenerate",
  socialTitle: "Discover meditations",
  description:
    "Meditations other people composed on Zenerate and chose to share. Written and narrated with AI, free to listen to, no account needed.",
  path: "/discover",
});

/** The active filters as removable chips, each a link to the state without it. */
function ActiveFilters({ filters }: { filters: DiscoverFilters }) {
  const chips: { key: keyof DiscoverFilters; label: string }[] = [];
  if (filters.category) {
    chips.push({ key: "category", label: getCategory(filters.category)?.label ?? filters.category });
  }
  if (filters.tag) chips.push({ key: "tag", label: TAG_LABELS[filters.tag] });
  if (filters.type) chips.push({ key: "type", label: TYPE_LABELS[filters.type] });
  if (filters.duration) {
    chips.push({
      key: "duration",
      label: DURATION_BUCKETS.find((b) => b.slug === filters.duration)?.label ?? "",
    });
  }
  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={discoverHref(filters, { [chip.key]: undefined })}
            aria-label={`Remove ${chip.label}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground outline-none hover:bg-secondary/80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {chip.label}
            <X aria-hidden className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Results({ filters }: { filters: DiscoverFilters }) {
  const supabase = await createClient();
  const [
    meditations,
    {
      data: { user },
    },
  ] = await Promise.all([getPublicMeditations(filters), supabase.auth.getUser()]);

  const category = filters.category ? getCategory(filters.category) : undefined;
  const heading = filters.q
    ? `Results for “${filters.q}”`
    : category
      ? category.label
      : "Filtered meditations";

  return (
    <section aria-labelledby="results-heading" className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="results-heading" className="font-serif text-xl font-medium">
            {heading}
          </h2>
          <Link
            href="/discover"
            className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Link>
        </div>
        <ActiveFilters filters={filters} />
      </div>

      {meditations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border px-6 py-16 text-center">
          <p className="text-muted-foreground">Nothing matches that yet.</p>
          <p className="text-xs text-muted-foreground">
            Try fewer filters, or a different word for the feeling.
          </p>
        </div>
      ) : (
        // Favouriting needs an account; signed out, the button would only error.
        <DiscoverViewWrapper
          summary={`${meditations.length} ${meditations.length === 1 ? "meditation" : "meditations"}`}
        >
          <MeditationListView meditations={meditations} showFavorite={!!user} />
        </DiscoverViewWrapper>
      )}
    </section>
  );
}

async function Rows() {
  const supabase = await createClient();
  const [
    popular,
    picked,
    {
      data: { user },
    },
  ] = await Promise.all([
    getPopularMeditations(),
    getPickedForYou(),
    supabase.auth.getUser(),
  ]);

  return (
    <>
      <DiscoverRow
        id="popular-heading"
        title="Popular"
        description="What listeners keep coming back to."
        meditations={popular}
      />
      <DiscoverRow
        id="picked-heading"
        title="Picked for you"
        description={
          user
            ? "Close to what you make and what you favorite."
            : "House picks to start with."
        }
        meditations={picked}
      />
    </>
  );
}

function RowsLoading() {
  return (
    <div className="space-y-10" aria-hidden>
      {[0, 1].map((row) => (
        <div key={row} className="space-y-4">
          <div className="h-6 w-40 rounded-md bg-muted/50 motion-safe:animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="aspect-square w-36 shrink-0 rounded-xl bg-muted/50 motion-safe:animate-pulse sm:w-44"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultsLoading() {
  return (
    <div className="space-y-3" aria-hidden>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 rounded-md border bg-muted/50 motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseDiscoverFilters(await searchParams);
  const active = hasActiveFilters(filters);

  return (
    // `data-back-label`: a meditation opened from here links back to this
    // exact URL, filters and all (src/components/back-origin.tsx).
    <div data-back-label="Discover" className="space-y-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-medium tracking-tight">Discover</h1>
          <p className="text-muted-foreground">
            Meditations people made here and chose to share.
          </p>
        </div>
        <DiscoverSearch filters={filters} />
      </div>

      {active ? (
        <Suspense key={JSON.stringify(filters)} fallback={<ResultsLoading />}>
          <Results filters={filters} />
        </Suspense>
      ) : (
        <>
          <CategoryGrid />
          <Suspense fallback={<RowsLoading />}>
            <Rows />
          </Suspense>
        </>
      )}
    </div>
  );
}
