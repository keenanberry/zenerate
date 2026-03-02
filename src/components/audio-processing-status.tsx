"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMeditationStatus } from "@/lib/meditation/actions";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";

interface AudioProcessingStatusProps {
  meditationId: string;
  onCompleted: () => void;
  onFailed: () => void;
}

export function AudioProcessingStatus({
  meditationId,
  onCompleted,
  onFailed,
}: AudioProcessingStatusProps) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    intervalRef.current = setInterval(async () => {
      try {
        const result = await getMeditationStatus(meditationId);

        if (result.status === "completed") {
          onCompleted();
          router.refresh();
        } else if (result.status === "failed") {
          setFailed(true);
          onFailed();
        }
      } catch {
        // Silently retry on next poll
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [meditationId, router, onFailed]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  if (failed) {
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
            onClick={() => {
              onFailed();
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium">Generating audio...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Converting your meditation script to audio. This usually takes 30-60 seconds.
          </p>
          <p className="mt-2 text-xs tabular-nums text-muted-foreground/70">
            {formatTime(elapsedSeconds)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
