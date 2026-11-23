"use client";

import { CollectionCard } from "@/components/collection-card";
import { CollectionRow } from "@/components/collection-row";
import { useView } from "@/components/view-context";
import type { CollectionWithCount } from "@/lib/meditation/types";

/** The listener's collections as the nearest ViewProvider chose: playlist tiles or rows. */
export function CollectionListView({ collections }: { collections: CollectionWithCount[] }) {
  const { view } = useView();

  if (view === "list") {
    return (
      <div className="w-full">
        {collections.map((c) => (
          <CollectionRow key={c.id} collection={c} />
        ))}
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
