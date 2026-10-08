"use client";

import { useCallback, useState } from "react";
import type { MeditationWithMeta, MeditationStatus } from "@/lib/meditation/types";
import { GenerateAudioPanel, type QuotaProp } from "@/components/generate-audio-panel";
import { AudioProcessingStatus } from "@/components/audio-processing-status";
import { AudioPlayer } from "@/components/audio-player";
import { getMeditationStatus } from "@/lib/meditation/actions";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AudioSectionProps {
  meditation: MeditationWithMeta;
  isOwner: boolean;
  isSignedIn: boolean;
  quota: QuotaProp;
  freeRetryEventId: string | null;
}

export function AudioSection({
  meditation,
  isOwner,
  isSignedIn,
  quota,
  freeRetryEventId,
}: AudioSectionProps) {
  const [status, setStatus] = useState<MeditationStatus>(meditation.status);
  const [audioUrl, setAudioUrl] = useState(meditation.audio_url);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleGenerationStarted = useCallback(() => {
    setStatus("processing_audio");
  }, []);

  const handleCompleted = useCallback(async () => {
    const result = await getMeditationStatus(meditation.id);
    setAudioUrl(result.audio_url);
    setStatus("completed");
  }, [meditation.id]);

  const handleFailed = useCallback(() => {
    setStatus("failed");
  }, []);

  async function handleFreeRetry() {
    if (!freeRetryEventId) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditationId: meditation.id,
          retryOfEventId: freeRetryEventId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to start retry");
      }
      setStatus("processing_audio");
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRetrying(false);
    }
  }

  if (status === "completed" && audioUrl) {
    return (
      <AudioPlayer
        audioUrl={audioUrl}
        meditationId={meditation.id}
        canDownload={isSignedIn}
      />
    );
  }

  if (status === "processing_audio") {
    return (
      <AudioProcessingStatus
        meditationId={meditation.id}
        onCompleted={handleCompleted}
        onFailed={handleFailed}
      />
    );
  }

  if (status === "failed" && isOwner) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-medium">Audio generation failed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Something went wrong during processing.
              {freeRetryEventId
                ? " You can retry once for free — it won't count against your monthly quota."
                : " A free retry isn't available for this meditation."}
            </p>
          </div>
          {retryError && (
            <p className="text-sm text-destructive">{retryError}</p>
          )}
          {freeRetryEventId && (
            <Button
              variant="default"
              className="gap-2"
              onClick={handleFreeRetry}
              disabled={retrying}
            >
              <RotateCcw className="h-4 w-4" />
              {retrying ? "Retrying..." : "Retry — free"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status === "script_ready" && isOwner) {
    return (
      <GenerateAudioPanel
        meditationId={meditation.id}
        quota={quota}
        onStarted={handleGenerationStarted}
      />
    );
  }

  return null;
}
