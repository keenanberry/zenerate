import { notFound } from "next/navigation";
import Link from "next/link";
import { getCollectionWithItems } from "@/lib/meditation/actions";
import { MeditationTrackList } from "@/components/meditation-track-list";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { MeditationWithMeta } from "@/lib/meditation/types";
import { RemoveFromCollectionButton } from "./remove-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const { collection } = await getCollectionWithItems(id);
    return { title: `${collection.name} | Zenerate` };
  } catch {
    return { title: "Collection | Zenerate" };
  }
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let collection, meditations;
  try {
    const data = await getCollectionWithItems(id);
    collection = data.collection;
    meditations = data.meditations;
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard?tab=collections">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Library
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{collection.name}</h1>
        {collection.description && (
          <p className="text-muted-foreground">{collection.description}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {meditations.length}{" "}
          {meditations.length === 1 ? "meditation" : "meditations"}
        </p>
      </div>

      {meditations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12">
          <p className="text-muted-foreground">This collection is empty.</p>
          <p className="text-xs text-muted-foreground">
            Add meditations from their detail page.
          </p>
        </div>
      ) : (
        <MeditationTrackList
          meditations={meditations as MeditationWithMeta[]}
          showFavorite={false}
          actions={(m) => (
            <RemoveFromCollectionButton
              collectionId={collection.id}
              meditationId={m.id}
            />
          )}
        />
      )}
    </div>
  );
}
