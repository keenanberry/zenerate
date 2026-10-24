import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMeditation } from "@/lib/meditation/actions";
import { AudioSection } from "@/components/audio-section";
import { ScriptPlaybackProvider } from "@/components/script-playback";
import {
  MeditationPageProvider,
  ScriptDisclosure,
} from "@/components/meditation-page";
import { ParentLink } from "@/components/parent-link";
import { MeditationCover } from "@/components/meditation-cover";
import { MeditationDetails } from "@/components/meditation-details";
import { getQuotaUsage, isFreeRetryAvailable } from "@/lib/audio/quota";
import { meditationMetadata } from "@/lib/seo/metadata";
import { getMeditationChatId } from "@/lib/chat/actions";
import { metaLine } from "@/lib/meditation/meta";
import { MeditationVersions } from "@/components/meditation-versions";

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

  const chatId = isOwner ? await getMeditationChatId(meditation.id) : null;
  const hasAudio = meditation.status === "completed" && !!meditation.audio_url;
  const length = meditation.settings?.duration
    ? `${meditation.settings.duration} min`
    : undefined;

  return (
    // A 48rem column: the header beside a 160px cover from `sm`, and a 65ch
    // script under it. The shell's grid width would leave both adrift.
    <div className="mx-auto max-w-3xl space-y-8">
      <MeditationPageProvider
        meditationId={meditation.id}
        isFavorited={meditation.is_favorited ?? false}
      >
        <ScriptPlaybackProvider>
          <div className="space-y-3">
            {/* The owner came from their library; everyone else, including a
                signed-in visitor on a shared link, belongs to Discover. */}
            <ParentLink href={isOwner ? "/dashboard" : "/discover"}>
              {isOwner ? "Library" : "Discover"}
            </ParentLink>

            {/* The cover runs full width on a phone, as album art does; from
                `sm` it sits at 160px beside the details. */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
              <MeditationCover
                id={meditation.id}
                tags={meditation.tags ?? []}
                title={meditation.title}
                size={320}
                className="h-auto w-full sm:size-40"
              />
              <div className="min-w-0 flex-1">
                <MeditationDetails
                  meditationId={meditation.id}
                  title={meditation.title}
                  description={meditation.description}
                  tags={meditation.tags ?? []}
                  meta={length}
                  isPublic={isOwner && hasAudio ? meditation.is_public : null}
                  menu={{
                    meditationId: meditation.id,
                    title: meditation.title,
                    isSignedIn: !!user,
                    isOwner,
                    chatId,
                    hasAudio,
                  }}
                >
                  {/* No status badge: a meditation's state is its audio, and
                      this says it, Play or otherwise (task 54). */}
                  <AudioSection
                    meditation={meditation}
                    isOwner={isOwner}
                    isSignedIn={!!user}
                    quota={quota}
                    freeRetryEventId={freeRetry.eventId}
                    meta={metaLine({ tags: meditation.tags, settings: meditation.settings })}
                  />
                </MeditationDetails>
              </div>
            </div>
          </div>

          {meditation.script && <ScriptDisclosure script={meditation.script} />}
        </ScriptPlaybackProvider>
      </MeditationPageProvider>

      {isOwner && <MeditationVersions meditationId={meditation.id} title={meditation.title} />}
    </div>
  );
}
