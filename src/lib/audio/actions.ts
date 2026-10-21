"use server";

import { createClient } from "@/lib/supabase/server";
import { getQuotaUsage, isFreeRetryAvailable } from "@/lib/audio/quota";
import { estimateDuration } from "@/lib/meditation/duration";
import type { MeditationSettings, MeditationStatus } from "@/lib/meditation/types";

export type AudioOffer = {
  title: string;
  status: MeditationStatus;
  /** True when the next render narrates a revision (draft_script). */
  rendersDraft: boolean;
  /** Whether Make audio can start a render from here. */
  canRender: boolean;
  /** Estimated length of the script the next render narrates. */
  estimatedSeconds: number;
  voice: string | null;
  quota: { remaining: number; limit: number; unlimited: boolean; resetsAt: string };
  /** The failed event a free retry would follow, when one is available. */
  freeRetryEventId: string | null;
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
    .select("title, status, script, draft_script, settings")
    .eq("id", meditationId)
    .single();
  if (error || !data) throw new Error("Meditation not found");

  const status = data.status as MeditationStatus;
  const rendersDraft = data.draft_script !== null;
  const script = (data.draft_script ?? data.script ?? "") as string;
  const [usage, retry] = await Promise.all([
    getQuotaUsage(user.id, supabase),
    status === "failed"
      ? isFreeRetryAvailable(meditationId, user.id, supabase)
      : Promise.resolve({ available: false, eventId: null }),
  ]);

  return {
    title: data.title as string,
    status,
    rendersDraft,
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
  };
}
