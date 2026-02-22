import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FolderOpen } from "lucide-react";
import type { CollectionWithCount } from "@/lib/meditation/types";

interface CollectionCardProps {
  collection: CollectionWithCount;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Link href={`/collections/${collection.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{collection.name}</CardTitle>
              {collection.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {collection.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {collection.item_count} {collection.item_count === 1 ? "meditation" : "meditations"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
