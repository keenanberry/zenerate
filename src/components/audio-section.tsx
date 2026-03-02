"use client";

import { useCallback, useState } from "react";
import type { MeditationWithMeta, MeditationStatus } from "@/lib/meditation/types";
import { GenerateAudioPanel } from "@/components/generate-audio-panel";
import { AudioProcessingStatus } from "@/components/audio-processing-status";
import { AudioPlayer } from "@/components/audio-player";
import {
  getMeditationStatus,
  resetMeditationStatus,
} from "@/lib/meditation/actions";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AudioSectionProps {
  meditation: MeditationWithMeta;
  isOwner: boolean;
}

export function AudioSection({ meditation, isOwner }: AudioSectionProps) {
  const [status, setStatus] = useState<MeditationStatus>(meditation.status);
  const [resetting, setResetting] = useState(false);

  const [audioUrl, setAudioUrl] = useState(meditation.audio_url);

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

  async function handleRetry() {
    setResetting(true);
    try {
      await resetMeditationStatus(meditation.id);
      setStatus("script_ready");
    } catch {
      // stay in failed state
    } finally {
      setResetting(false);
    }
  }

  if (status === "completed" && audioUrl) {
    return <AudioPlayer audioUrl={audioUrl} />;
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
              Something went wrong during processing. You can try again with the
              same or a different voice.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleRetry}
            disabled={resetting}
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? "Resetting..." : "Try Again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "script_ready" && isOwner) {
    return (
      <GenerateAudioPanel
        meditationId={meditation.id}
        onStarted={handleGenerationStarted}
      />
    );
  }

  // Non-owner viewing a script_ready meditation, or other states
  return null;
}
