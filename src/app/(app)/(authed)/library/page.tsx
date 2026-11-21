import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MeditationListView } from "@/components/meditation-list-view";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { CollectionCard } from "@/components/collection-card";
import { AccountAvatarLink } from "@/components/account-avatar-link";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/navigation/app-tabs";
import {
  getUserMeditations,
  getFavoriteMeditations,
  getUserCollections,
} from "@/lib/meditation/actions";
import { Plus } from "lucide-react";

export const metadata = {
  title: "Library | Zenerate",
};

async function MyMeditations() {
  const meditations = await getUserMeditations();

  if (meditations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-16 text-center">
        <p className="text-muted-foreground">No meditations yet.</p>
        <Link href="/create">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Create your first meditation
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <MeditationListView
      meditations={meditations}
      showVisibility
    />
  );
}

async function Favorites() {
  const meditations = await getFavoriteMeditations();

  if (meditations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-16 text-center">
        <p className="text-muted-foreground">No favorites yet.</p>
        <Link href="/discover">
          <Button variant="outline" size="sm" className="gap-2">
            Browse Discover
          </Button>
        </Link>
      </div>
    );
  }

  return <MeditationListView meditations={meditations} />;
}

async function Collections() {
  const collections = await getUserCollections();

  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-16 text-center">
        <p className="text-muted-foreground">No collections yet.</p>
        <p className="text-xs text-muted-foreground">
          Create collections from any meditation detail page.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
      {collections.map((c) => (
        <CollectionCard key={c.id} collection={c} />
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-md border bg-muted/50 motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  // The phone's way to Account (from md it is in the top bar). The (authed)
  // layout has already sent signed-out visitors to /login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle<{ display_name: string | null }>()
    : { data: null };
  const avatar = initials(profile?.display_name ?? null, user?.email ?? null);

  return (
    // `data-back-label`: a meditation opened from either tab links back to
    // it (src/components/back-origin.tsx).
    <div data-back-label="Library" className="space-y-10">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="font-serif text-2xl font-medium tracking-tight">Library</h1>
          <p className="text-muted-foreground">
            Your meditations, favorites, and collections.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New meditation</span>
            </Button>
          </Link>
          <AccountAvatarLink initials={avatar} className="md:hidden" />
        </div>
      </div>

      <DashboardTabs
        defaultTab={tab}
        meditationsContent={
          <Suspense fallback={<Loading />}>
            <MyMeditations />
          </Suspense>
        }
        favoritesContent={
          <Suspense fallback={<Loading />}>
            <Favorites />
          </Suspense>
        }
        collectionsContent={
          <Suspense fallback={<Loading />}>
            <Collections />
          </Suspense>
        }
      />
    </div>
  );
}
