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
    draftRender: renderStatus !== null,
    // status already folds in render_status, so a draft render in flight reads
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
