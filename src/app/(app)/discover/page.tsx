import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPublicMeditations } from "@/lib/meditation/actions";
import { MeditationListView } from "@/components/meditation-list-view";
import { DiscoverViewWrapper } from "./view-wrapper";
import { DiscoverSearch } from "./search";

export const metadata = {
  title: "Discover | Zenerate",
};

async function DiscoverFeed({ search }: { search?: string }) {
  const supabase = await createClient();
  const [
    meditations,
    {
      data: { user },
    },
  ] = await Promise.all([getPublicMeditations(search), supabase.auth.getUser()]);

  if (meditations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
        <p className="text-muted-foreground">
          {search ? "No meditations found." : "No public meditations yet."}
        </p>
        <p className="text-xs text-muted-foreground">
          {search
            ? "Try a different search term."
            : "Be the first to share a meditation with the community!"}
        </p>
      </div>
    );
  }

  // Favouriting needs an account; signed out, the button would only error.
  return <MeditationListView meditations={meditations} showFavorite={!!user} />;
}

function Loading() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-md border bg-muted/50"
        />
      ))}
    </div>
  );
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">Discover</h1>
        <p className="text-muted-foreground">
          Explore meditations shared by the community.
        </p>
      </div>

      <DiscoverViewWrapper search={<DiscoverSearch initialQuery={q} />}>
        <Suspense fallback={<Loading />}>
          <DiscoverFeed search={q} />
        </Suspense>
      </DiscoverViewWrapper>
    </div>
  );
}
