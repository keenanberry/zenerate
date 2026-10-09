"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoicePicker } from "@/components/voice-picker";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_VOICE_ID } from "@/lib/voices/catalog";

export type QuotaProp = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
};

interface GenerateAudioPanelProps {
  meditationId: string;
  quota: QuotaProp;
  onStarted: () => void;
}

export function GenerateAudioPanel({
  meditationId,
  quota,
  onStarted,
}: GenerateAudioPanelProps) {
  // Pre-selected, so the voice that will be used is the one shown.
  const [selectedVoiceId, setSelectedVoiceId] = useState(DEFAULT_VOICE_ID);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exhausted = quota.remaining === 0;
  const isLast = quota.remaining === 1;
  const resetDate = new Date(quota.resetsAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
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
          voiceId: selectedVoiceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error("Monthly limit reached");
        }
        if (res.status === 503) {
          throw new Error(
            "Audio generation is temporarily paused. Please try again next month.",
          );
        }
        throw new Error(data.error ?? "Failed to start audio generation");
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
    if (isLast && !confirming) {
      setConfirming(true);
      return;
    }
    submit();
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-1">
          <h2 className="font-serif text-lg font-medium">Generate Audio</h2>
          <p className="text-sm text-muted-foreground">
            Select a voice and generate the audio for your meditation.
          </p>
        </div>

        <VoicePicker
          selectedVoiceId={selectedVoiceId}
          onSelect={setSelectedVoiceId}
        />

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {exhausted ? (
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
          <Button
            onClick={handlePrimaryClick}
            disabled={generating || exhausted}
            className="w-full gap-2"
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting generation...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Audio
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
