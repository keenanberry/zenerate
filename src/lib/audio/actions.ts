"use server";

import { createClient } from "@/lib/supabase/server";
import { getQuotaUsage, isFreeRetryAvailable } from "@/lib/audio/quota";
import { estimateDuration } from "@/lib/meditation/duration";
import type { MeditationSettings, MeditationStatus } from "@/lib/meditation/types";

export type AudioOffer = {
  title: string;
  /**
   * The render's status as the owner's card sees it. A draft render leaves
   * the meditation completed for everyone else, so its processing and failed
   * states come from draft_status and are reported here as
   * processing_audio and failed.
   */
  status: MeditationStatus;
  /** True when the next render narrates a revision (draft_script). */
  rendersDraft: boolean;
  /** True while a draft render is in flight or has failed (draft_status is set). */
  draftRender: boolean;
  /** Whether Make audio can start a render from here. */
  canRender: boolean;
  /** Estimated length of the script the next render narrates. */
  estimatedSeconds: number;
  voice: string | null;
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

  const { data, error } = await supabase
    .from("meditations")
    .select("title, status, draft_status, script, draft_script, settings")
    .eq("id", meditationId)
    .single();
  if (error || !data) throw new Error("Meditation not found");

  const status: MeditationStatus =
    data.draft_status === "processing"
      ? "processing_audio"
      : data.draft_status === "failed"
        ? "failed"
        : (data.status as MeditationStatus);
  const rendersDraft = data.draft_script !== null;
  const script = (data.draft_script ?? data.script ?? "") as string;
  const [usage, retry, latestVersion] = await Promise.all([
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
  ]);

  return {
    title: data.title as string,
    status,
    rendersDraft,
    draftRender: data.draft_status !== null,
    // status already folds in draft_status, so a draft render in flight reads
    // as processing_audio here and cannot be started twice.
    canRender: status === "script_ready" || (status === "completed" && rendersDraft),
    estimatedSeconds: estimateDuration(script).totalSeconds,
    voice: (data.settings as MeditationSettings | null)?.voice ?? null,
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
