"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

// One preview at a time across every card in the chat, sound effects and
// ambient beds alike. Each player registers how to stop itself when it starts.
let stopPlaying: (() => void) | null = null;

export type PreviewState = "idle" | "loading" | "playing";

/** Play and stop one preview file, created on the first tap. */
export function usePreviewPlayer(url: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PreviewState>("idle");
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
    const audio = audioRef.current ?? new Audio(url);
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

  return { state, failed, toggle };
}

/** The round play / stop button for a preview. */
export function PreviewButton({
  label,
  state,
  onClick,
}: {
  label: string;
  state: PreviewState;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={state === "idle" ? `Play ${label}` : `Stop ${label}`}
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
  );
}
