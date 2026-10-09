import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPublicMeditations } from "@/lib/meditation/actions";
import { pageMetadata } from "@/lib/seo/metadata";
import { MeditationListView } from "@/components/meditation-list-view";
import { DiscoverViewWrapper } from "./view-wrapper";
import { DiscoverSearch } from "./search";

export const metadata = pageMetadata({
  title: "Discover | Zenerate",
  socialTitle: "Discover meditations",
  description:
    "Meditations other people composed on Zenerate and chose to share. Written and narrated with AI, free to listen to, no account needed.",
  path: "/discover",
});

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
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border px-6 py-16 text-center">
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
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-md border bg-muted/50 motion-safe:animate-pulse"
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
    <div className="space-y-10">
      <div className="space-y-2">
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
