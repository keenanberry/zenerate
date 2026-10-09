import { cache } from "react";
import type { Metadata } from "next";
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
import { ScriptPlaybackProvider } from "@/components/script-playback";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getQuotaUsage, isFreeRetryAvailable } from "@/lib/audio/quota";
import { meditationMetadata } from "@/lib/seo/metadata";

// One read per request, shared by generateMetadata and the page. React's
// cache is scoped to this request's render and keeps nothing between viewers;
// the read stays cookie-bound and the route stays dynamic. Do not swap it for
// unstable_cache, "use cache" or revalidate: the result carries a signed audio
// URL minted for this viewer (see src/lib/audio/signed-url.ts).
const loadMeditation = cache(getMeditation);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    return meditationMetadata(await loadMeditation(id));
  } catch {
    return meditationMetadata(null);
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
    meditation = await loadMeditation(id);
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
    // The player and a 65ch script set the width; the shell's grid width
    // would leave the script floating in a wide card.
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-6">
        <Link href={user ? "/dashboard" : "/discover"}>
          <Button variant="ghost" size="sm" className="-ml-3 gap-2">
            <ArrowLeft className="h-4 w-4" />
            {user ? "Back to Library" : "Back to Discover"}
          </Button>
        </Link>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-balance">
              {meditation.title}
            </h1>
            <p className="max-w-[60ch] text-muted-foreground">{meditation.prompt}</p>
            <div className="flex items-center gap-3 pt-1">
              <Badge variant="secondary">{meditation.status.replace(/_/g, " ")}</Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
      </div>

      <ScriptPlaybackProvider>
        <div className="space-y-10">
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
                <CardTitle className="font-serif text-xl font-medium">
                  Meditation Script
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScriptViewer script={meditation.script} />
              </CardContent>
            </Card>
          )}
        </div>
      </ScriptPlaybackProvider>
    </div>
  );
}
