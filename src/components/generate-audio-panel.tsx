"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AmbienceChoice, VoiceChoice } from "@/components/audio-choices";
import { AudioLines, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_VOICE_ID } from "@/lib/voices/catalog";
import { generateErrorMessage } from "@/lib/audio/generate-error";
import { getLastAudioChoices, type LastAudioChoices } from "@/lib/audio/actions";
import { choiceNote, resolveChoice } from "@/lib/audio/choices";
import { savedAmbience, type AmbienceId } from "@/lib/meditation/ambience";
import type { MeditationSettings } from "@/lib/meditation/types";

export type QuotaProp = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  /** An exempt operator: no cap applies. */
  unlimited?: boolean;
};

interface GenerateAudioPanelProps {
  meditationId: string;
  /** This meditation's saved voice and bed, preselected before last time's. */
  settings: MeditationSettings | null;
  quota: QuotaProp;
  onStarted: () => void;
}

export function GenerateAudioPanel({
  meditationId,
  settings,
  quota,
  onStarted,
}: GenerateAudioPanelProps) {
  // The person's picks; until they make one, the shown choice is preselected,
  // so the voice and bed that will be used are the ones shown.
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [ambience, setAmbience] = useState<AmbienceId | null>(null);
  // Null until read, so the choices never flash the defaults first.
  const [lastUsed, setLastUsed] = useState<LastAudioChoices | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exhausted = !quota.unlimited && quota.remaining === 0;
  const isLast = !quota.unlimited && quota.remaining === 1;
  const resetDate = new Date(quota.resetsAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  useEffect(() => {
    getLastAudioChoices()
      .catch(() => ({ voice: null, ambience: null }))
      .then(setLastUsed);
  }, []);

  const voice = resolveChoice({
    picked: voiceId,
    saved: settings?.voice,
    lastUsed: lastUsed?.voice,
    fallback: DEFAULT_VOICE_ID,
  });
  const bed = resolveChoice<AmbienceId>({
    picked: ambience,
    saved: savedAmbience(settings?.music),
    lastUsed: lastUsed?.ambience,
    fallback: "none",
  });

  async function submit() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditationId,
          voiceId: voice.value,
          ambience: bed.value,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(generateErrorMessage(res.status, data));
      }

      // Success only. Failures are rendered inline by this panel already --
      // toasting them too would report one failure twice.
      toast.success("Audio generation started", {
        description: "This takes a few minutes. You can leave this page.",
      });
      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
      setConfirming(false);
    }
  }

  function handlePrimaryClick() {
    // The button stays enabled while starting (no faded state), so a second
    // press, by keyboard too, is stopped here.
    if (generating) return;
    if (isLast && !confirming) {
      setConfirming(true);
      return;
    }
    submit();
  }

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-serif text-lg font-medium">Generate Audio</h2>
          <p className="text-sm text-muted-foreground">
            Choose a voice and a background, then generate the audio for your meditation.
          </p>
        </div>

        {/* The same choices as the studio's audio card, so the two never drift apart. */}
        {lastUsed ? (
          <div className="divide-y border-y">
            <VoiceChoice
              selectedVoiceId={voice.value}
              note={choiceNote(voice.origin)}
              onSelect={setVoiceId}
            />
            <AmbienceChoice
              selected={bed.value}
              note={choiceNote(bed.origin)}
              onSelect={setAmbience}
            />
          </div>
        ) : (
          <p className="flex items-center gap-2 border-y py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
            Loading voices…
          </p>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {quota.unlimited ? (
          <p className="text-xs text-muted-foreground">
            Your account has unlimited audio generations.
          </p>
        ) : exhausted ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            You&apos;ve used all {quota.limit} audio generations this month. Resets {resetDate}.
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This will use 1 of your {quota.remaining} remaining audio generations this month.
          </p>
        )}

        {confirming ? (
          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={generating}
              className="flex-1 gap-2"
              size="lg"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting generation...
                </>
              ) : (
                "Confirm — use last generation"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={generating}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        ) : (
          // Full strength while starting, as in the studio's audio card (task 50).
          <Button
            onClick={handlePrimaryClick}
            disabled={exhausted || !lastUsed}
            aria-disabled={generating || undefined}
            aria-busy={generating || undefined}
            className={cn("w-full gap-2", generating && "pointer-events-none")}
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <AudioLines className="h-4 w-4" />
                Generate Audio
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
