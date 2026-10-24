"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getQuotaUsage, isFreeRetryAvailable } from "@/lib/audio/quota";
import { estimateDuration } from "@/lib/meditation/duration";
import type { MeditationSettings, MeditationStatus } from "@/lib/meditation/types";
import { savedAmbience, type AmbienceId } from "@/lib/meditation/ambience";
import { getVoices } from "@/lib/voices/server";

/** The voice and bed of the person's most recent completed meditation. */
export type LastAudioChoices = { voice: string | null; ambience: AmbienceId | null };

export type AudioOffer = {
  title: string;
  /**
   * The render's status as the owner's card sees it. A draft render leaves
   * the meditation completed for everyone else, so its processing and failed
   * states come from the draft's render_status and are reported here as
   * processing_audio and failed.
   */
  status: MeditationStatus;
  /** True when the next render narrates a revision (a meditation_drafts row). */
  rendersDraft: boolean;
  /** True while a draft render is in flight or has failed (render_status is set). */
  draftRender: boolean;
  /** Whether Make audio can start a render from here. */
  canRender: boolean;
  /** Estimated length of the script the next render narrates. */
  estimatedSeconds: number;
  voice: string | null;
  /** The bed the last render was made with (settings.music), or null before any choice. */
  ambience: AmbienceId | null;
  /** What the person chose last time on any meditation, preselected when this one has no choice of its own. */
  lastUsed: LastAudioChoices;
  quota: { remaining: number; limit: number; unlimited: boolean; resetsAt: string };
  /** The failed event a free retry would follow, when one is available. */
  freeRetryEventId: string | null;
  /** The newest archived version: what a draft render just replaced. */
  latestVersionId: string | null;
};

/**
 * What the studio's audio card needs before it can offer a render. Read
 * through the caller's RLS-bound client, so someone else's meditation is
 * simply not found.
 */
export async function getAudioOffer(meditationId: string): Promise<AudioOffer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [{ data, error }, { data: draft, error: draftError }] = await Promise.all([
    supabase
      .from("meditations")
      .select("title, status, script, settings")
      .eq("id", meditationId)
      .single(),
    supabase
      .from("meditation_drafts")
      .select("script, render_status")
      .eq("meditation_id", meditationId)
      .maybeSingle(),
  ]);
  if (error || !data) throw new Error("Meditation not found");
  if (draftError) throw new Error("The draft could not be read");

  const renderStatus = (draft?.render_status ?? null) as "processing" | "failed" | null;
  const status: MeditationStatus =
    renderStatus === "processing"
      ? "processing_audio"
      : renderStatus === "failed"
        ? "failed"
        : (data.status as MeditationStatus);
  const rendersDraft = draft !== null;
  const script = (draft?.script ?? data.script ?? "") as string;
  const [usage, retry, latestVersion, lastUsed] = await Promise.all([
    getQuotaUsage(user.id, supabase),
    status === "failed"
      ? isFreeRetryAvailable(meditationId, user.id, supabase)
      : Promise.resolve({ available: false, eventId: null }),
    supabase
      .from("meditation_versions")
      .select("id")
      .eq("meditation_id", meditationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    lastAudioChoices(supabase, user.id),
  ]);

  return {
    title: data.title as string,
    status,
    rendersDraft,
    draftRender: renderStatus !== null,
    // status already folds in render_status, so a draft render in flight reads
    // as processing_audio here and cannot be started twice.
    canRender: status === "script_ready" || (status === "completed" && rendersDraft),
    estimatedSeconds: estimateDuration(script).totalSeconds,
    voice: (data.settings as MeditationSettings | null)?.voice ?? null,
    ambience: savedAmbience((data.settings as MeditationSettings | null)?.music),
    lastUsed,
    quota: {
      remaining: usage.remaining,
      limit: usage.limit,
      unlimited: usage.unlimited,
      resetsAt: usage.resetsAt,
    },
    freeRetryEventId: retry.eventId,
    latestVersionId: (latestVersion.data?.id as string | undefined) ?? null,
  };
}

/**
 * The voice and bed from the owner's most recent completed meditation's
 * settings, read through their RLS-bound client and filtered to their own
 * rows. A voice since removed from the collection is dropped, so the card
 * never preselects one the generate route would refuse. Never throws: with
 * nothing to go on the card offers its defaults.
 */
async function lastAudioChoices(supabase: SupabaseClient, userId: string): Promise<LastAudioChoices> {
  const none = { voice: null, ambience: null };
  const { data, error } = await supabase
    .from("meditations")
    .select("settings")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return none;

  const settings = (data.settings as MeditationSettings | null) ?? {};
  let voice = settings.voice ?? null;
  if (voice) {
    try {
      const voices = await getVoices();
      if (!voices.some((v) => v.voiceId === voice)) voice = null;
    } catch {
      // ElevenLabs is unreachable; the voice list and the render fail with it.
    }
  }
  return { voice, ambience: savedAmbience(settings.music) };
}

/** Last time's voice and bed, for the meditation page's Generate Audio panel. */
export async function getLastAudioChoices(): Promise<LastAudioChoices> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { voice: null, ambience: null };
  return lastAudioChoices(supabase, user.id);
}
