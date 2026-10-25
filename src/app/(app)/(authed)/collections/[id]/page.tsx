import { notFound } from "next/navigation";
import { getCollectionWithItems } from "@/lib/meditation/actions";
import { MeditationTrackList } from "@/components/meditation-track-list";
import { CollectionArtwork } from "@/components/collection-artwork";
import { ParentLink } from "@/components/parent-link";
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
    // `data-back-label`: a meditation opened from here links back to this
    // collection by name (src/components/back-origin.tsx).
    <div data-back-label={collection.name} className="space-y-10">
      <div className="space-y-3">
        <ParentLink href="/dashboard?tab=collections">Collections</ParentLink>

        {/* Laid out as the meditation page is: artwork, then the details. */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <CollectionArtwork
            id={collection.id}
            covers={(meditations as MeditationWithMeta[]).slice(0, 4)}
            size={160}
            className="w-40 shrink-0"
          />
          <div className="min-w-0 space-y-2">
            <h1 className="font-serif text-2xl font-medium tracking-tight">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="max-w-[60ch] text-muted-foreground">
                {collection.description}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {meditations.length}{" "}
              {meditations.length === 1 ? "meditation" : "meditations"}
            </p>
          </div>
        </div>
      </div>

      {meditations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border px-6 py-16 text-center">
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
