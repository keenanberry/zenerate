"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StudioUIMessage } from "@/lib/chat/tools";
import type { SoundPreview } from "@/lib/meditation/sound-previews";
import { cn } from "@/lib/utils";

type PreviewSoundsPart = Extract<StudioUIMessage["parts"][number], { type: "tool-previewSounds" }>;

// One sound at a time across every card in the chat, not only this one. Each
// row registers how to stop itself when it starts.
let stopPlaying: (() => void) | null = null;

function SoundRow({ sound }: { sound: SoundPreview }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setState("idle");
  }

  async function toggle() {
    if (state !== "idle") {
      stop();
      if (stopPlaying === stop) stopPlaying = null;
      return;
    }

    stopPlaying?.();
    stopPlaying = stop;

    // Created on the first tap, inside the gesture, so phones allow playback
    // and nothing downloads until someone asks to hear it.
    const audio = audioRef.current ?? new Audio(sound.url);
    if (!audioRef.current) {
      audioRef.current = audio;
      audio.addEventListener("ended", () => setState("idle"));
      audio.addEventListener("playing", () => setState("playing"));
    }
    setFailed(false);
    setState("loading");
    try {
      await audio.play();
    } catch (err) {
      setState("idle");
      // A stop tapped while it was still loading aborts play(); that is not a failure.
      if (!(err instanceof DOMException && err.name === "AbortError")) setFailed(true);
    }
  }

  const label = state === "idle" ? `Play ${sound.label}` : `Stop ${sound.label}`;

  return (
    <li className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={state !== "idle"}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border bg-secondary text-secondary-foreground",
          "hover:bg-card-hover focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          "motion-safe:transition-colors",
        )}
      >
        {state === "loading" ? (
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
        ) : state === "playing" ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="size-4 translate-x-px" aria-hidden />
        )}
      </button>
      <span className="min-w-0 flex-1 text-sm font-medium">{sound.label}</span>
      {failed ? (
        <span className="text-sm text-candle">Couldn&apos;t play</span>
      ) : (
        <span className="text-sm text-muted-foreground tabular-nums">{sound.seconds}s</span>
      )}
    </li>
  );
}

/** The `previewSounds` tool part: a row per sound, each with a play button and its length. */
export function SoundPreviewCard({ part }: { part: PreviewSoundsPart }) {
  if (part.state === "output-error") {
    return <p className="text-sm text-muted-foreground">The sounds couldn&apos;t be loaded.</p>;
  }
  if (part.state !== "output-available") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
        Finding the sounds...
      </p>
    );
  }

  return (
    <Card>
      <CardContent>
        <ul className="space-y-3" aria-label="Sound previews">
          {part.output.sounds.map((sound) => (
            <SoundRow key={sound.name} sound={sound} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
