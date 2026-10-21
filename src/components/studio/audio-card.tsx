"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { UseChatHelpers } from "@ai-sdk/react";
import { AlertCircle, ArrowUpRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoicePicker } from "@/components/voice-picker";
import { AudioProcessingStatus } from "@/components/audio-processing-status";
import { AudioPlayer } from "@/components/audio-player";
import { getAudioOffer, type AudioOffer } from "@/lib/audio/actions";
import { generateErrorMessage } from "@/lib/audio/generate-error";
import { getMeditationStatus } from "@/lib/meditation/actions";
import { DEFAULT_VOICE_ID } from "@/lib/voices/catalog";
import type { StudioUIMessage } from "@/lib/chat/tools";

type OfferAudioPart = Extract<StudioUIMessage["parts"][number], { type: "tool-offerAudio" }>;

interface AudioCardProps {
  part: OfferAudioPart;
  chatId: string;
  /** Null until the first writeScript has created the meditation. */
  meditationId: string | null;
  addToolOutput: UseChatHelpers<StudioUIMessage>["addToolOutput"];
}

function formatLength(seconds: number) {
  return `about ${Math.max(1, Math.round(seconds / 60))} min`;
}

function rendersLeft(quota: AudioOffer["quota"]) {
  if (quota.unlimited) return "Unlimited renders";
  if (quota.remaining === 0) return `No renders left this month`;
  return `${quota.remaining} of ${quota.limit} renders left this month`;
}

/**
 * The `offerAudio` tool part: pick a voice, make the audio, watch it render,
 * then play it here. The agent only shows this card. A render starts on the
 * owner's click and nowhere else, and only then is the tool answered.
 */
export function AudioCard({ part, meditationId, addToolOutput }: AudioCardProps) {
  const [offer, setOffer] = useState<AudioOffer | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State updates are async, so a second click in the same frame would still
  // see `starting` false. The ref closes that gap.
  const startingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!meditationId) return;
    try {
      const [next, status] = await Promise.all([
        getAudioOffer(meditationId),
        getMeditationStatus(meditationId),
      ]);
      setOffer(next);
      setAudioUrl(status.audio_url);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [meditationId]);

  useEffect(() => {
    // The card's state lives in the meditation, not the message.
    refresh();
  }, [refresh]);

  const awaitingAnswer = part.state === "input-available";
  const dismissed = part.state === "output-available" && part.output.outcome === "dismissed";

  async function start(body: Record<string, unknown>, answer: boolean) {
    if (!meditationId || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meditationId, ...body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(generateErrorMessage(res.status, data));
      }
      setOffer((current) => current && { ...current, status: "processing_audio" });
      if (answer) {
        addToolOutput({
          tool: "offerAudio",
          toolCallId: part.toolCallId,
          output: { outcome: "started", voice: (body.voiceId as string) ?? undefined },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // A 409 means the meditation moved on (another tab started it); show
      // where it is now rather than a button that will keep failing.
      refresh();
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  function dismiss() {
    addToolOutput({
      tool: "offerAudio",
      toolCallId: part.toolCallId,
      output: { outcome: "dismissed" },
    });
  }

  const handleCompleted = useCallback(() => {
    refresh();
  }, [refresh]);

  if (dismissed) {
    return (
      <p className="text-sm text-muted-foreground">
        Audio skipped for now. Ask for it whenever you&apos;re ready.
      </p>
    );
  }

  if (!meditationId || loadError) {
    return (
      <Card>
        <CardContent className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Make the audio</h2>
          <p className="text-sm text-muted-foreground">
            {loadError
              ? "This meditation couldn't be loaded. Reload the page to try again."
              : "Audio becomes available once there's a script."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!offer) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading audio options...
        </CardContent>
      </Card>
    );
  }

  if (offer.status === "processing_audio") {
    return (
      <AudioProcessingStatus
        meditationId={meditationId}
        onCompleted={handleCompleted}
        onFailed={handleCompleted}
      />
    );
  }

  if (offer.status === "failed") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-5 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-medium">Audio generation failed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {offer.freeRetryEventId
                ? "Something went wrong during processing. You can retry once for free."
                : "Something went wrong during processing, and a free retry isn't available."}
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {offer.freeRetryEventId && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={starting}
              onClick={() => start({ retryOfEventId: offer.freeRetryEventId }, false)}
            >
              <RotateCcw className="h-4 w-4" />
              {starting ? "Retrying..." : "Retry — free"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // The offer itself, only while the tool is still waiting for an answer. An
  // answered card shows the audio it led to instead.
  if (awaitingAnswer && offer.canRender) {
    const exhausted = !offer.quota.unlimited && offer.quota.remaining === 0;
    const selected = voiceId ?? offer.voice ?? DEFAULT_VOICE_ID;

    return (
      <Card>
        <CardContent className="space-y-6">
          <div className="space-y-1">
            <h2 className="font-serif text-lg font-medium">Make the audio</h2>
            <p className="text-sm text-muted-foreground">
              {offer.rendersDraft
                ? "Narrates your latest revision. Its audio replaces the current audio."
                : "Pick a voice, then make the audio. It plays right here when it's ready."}
            </p>
          </div>

          <VoicePicker selectedVoiceId={selected} onSelect={setVoiceId} />

          <p className="text-xs tabular-nums text-muted-foreground">
            Runs {formatLength(offer.estimatedSeconds)} · {rendersLeft(offer.quota)}
          </p>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={dismiss} disabled={starting}>
              Not now
            </Button>
            <Button
              onClick={() => start({ voiceId: selected }, true)}
              disabled={starting || exhausted}
              className="gap-2 sm:min-w-40"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Make audio
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (audioUrl) {
    return (
      <div className="space-y-2">
        <AudioPlayer
          audioUrl={audioUrl}
          title={offer.title}
          meditationId={meditationId}
          canDownload
        />
        <Link
          href={`/meditation/${meditationId}`}
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          Open the meditation page
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      There&apos;s no audio for this meditation yet.
    </p>
  );
}
