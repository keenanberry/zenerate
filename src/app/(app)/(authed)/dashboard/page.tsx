import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MeditationListView } from "@/components/meditation-list-view";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { CollectionCard } from "@/components/collection-card";
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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="font-serif text-2xl font-medium tracking-tight">Library</h1>
          <p className="text-muted-foreground">
            Your meditations, favorites, and collections.
          </p>
        </div>
        <Link href="/create" className="shrink-0">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Meditation</span>
          </Button>
        </Link>
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
