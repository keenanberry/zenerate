import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMeditation } from "@/lib/meditation/actions";
import { ScriptViewer } from "@/components/script-viewer";
import { AudioSection } from "@/components/audio-section";
import { FavoriteButton } from "@/components/favorite-button";
import { VisibilityToggle } from "@/components/visibility-toggle";
import { AddToCollectionDialog } from "@/components/add-to-collection-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getQuotaUsage, isFreeRetryAvailable } from "@/lib/audio/quota";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const meditation = await getMeditation(id);
    return { title: `${meditation.title} | Zenerate` };
  } catch {
    return { title: "Meditation | Zenerate" };
  }
}

export default async function MeditationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let meditation;
  try {
    meditation = await getMeditation(id);
  } catch {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === meditation.user_id;

  const quota =
    user && isOwner
      ? await getQuotaUsage(user.id, supabase)
      : { used: 0, limit: 0, remaining: 0, resetsAt: new Date().toISOString() };

  const freeRetry =
    user && isOwner && meditation.status === "failed"
      ? await isFreeRetryAvailable(meditation.id, user.id, supabase)
      : { available: false, eventId: null };

  return (
    <div className="space-y-6">
      <Link href={user ? "/dashboard" : "/discover"}>
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {user ? "Back to Library" : "Back to Discover"}
        </Button>
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            {meditation.title}
          </h1>
          <p className="text-sm text-muted-foreground">{meditation.prompt}</p>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="secondary">{meditation.status.replace(/_/g, " ")}</Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(meditation.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && meditation.status === "completed" && (
            <VisibilityToggle
              meditationId={meditation.id}
              isPublic={meditation.is_public}
            />
          )}
          {user && (
            <>
              <FavoriteButton
                meditationId={meditation.id}
                isFavorited={meditation.is_favorited ?? false}
                size="default"
              />
              <AddToCollectionDialog meditationId={meditation.id} />
            </>
          )}
        </div>
      </div>

      <Separator />

      <AudioSection
        meditation={meditation}
        isOwner={isOwner}
        isSignedIn={!!user}
        quota={quota}
        freeRetryEventId={freeRetry.eventId}
      />

      {meditation.script && (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-lg font-medium">
              Meditation Script
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScriptViewer script={meditation.script} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
