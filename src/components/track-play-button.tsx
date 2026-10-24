"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

let activeAudio: HTMLAudioElement | null = null;
let activeCleanup: (() => void) | null = null;

export interface TrackAudio {
  canPlay: boolean;
  playing: boolean;
  status: string;
  toggle: (e: React.MouseEvent) => void;
}

/**
 * A row's audio: one element per row, and one row playing at a time across
 * the page. Its trigger is the index column from `sm`; on a phone the row
 * opens the meditation's page instead (task 55).
 */
export function useTrackAudio({
  audioUrl,
  status,
  onPlayingChange,
}: {
  audioUrl: string | null;
  status: string;
  onPlayingChange?: (playing: boolean) => void;
}): TrackAudio {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const canPlay = status === "completed" && !!audioUrl;

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaying(false);
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  useEffect(() => {
    return () => {
      stop();
      if (activeAudio === audioRef.current) {
        activeAudio = null;
        activeCleanup = null;
      }
    };
  }, [stop]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!canPlay) return;

    if (playing) {
      stop();
      if (activeAudio === audioRef.current) {
        activeAudio = null;
        activeCleanup = null;
      }
      return;
    }

    if (activeAudio && activeCleanup) {
      activeCleanup();
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl!);
      audioRef.current.addEventListener("ended", stop);
    }

    activeAudio = audioRef.current;
    activeCleanup = stop;
    audioRef.current.play();
    setPlaying(true);
    onPlayingChange?.(true);
  }

  return { canPlay, playing, status, toggle };
}

function unplayableMessage(status: string) {
  return status === "processing_audio"
    ? "Audio is being generated…"
    : status === "failed"
      ? "Audio generation failed"
      : "Generate audio first";
}

/** The index column from `sm`: the number, a play icon on row hover. */
export function TrackPlayButton({
  audio,
  index,
  title,
  className,
}: {
  audio: TrackAudio;
  index: number;
  title: string;
  className?: string;
}) {
  if (!audio.canPlay) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-disabled
            aria-label={`${title}: ${unplayableMessage(audio.status)}`}
            className={cn(
              "relative z-10 w-8 cursor-not-allowed items-center justify-center text-sm text-muted-foreground/40 tabular-nums",
              className,
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span className="group-hover:hidden">{index}</span>
            <Play className="hidden h-3.5 w-3.5 fill-current group-hover:block" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{unplayableMessage(audio.status)}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={audio.toggle}
      aria-label={audio.playing ? `Pause ${title}` : `Play ${title}`}
      className={cn(
        "relative z-10 w-8 cursor-pointer items-center justify-center text-sm tabular-nums",
        audio.playing ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {audio.playing ? (
        <Pause className="h-3.5 w-3.5 fill-current" />
      ) : (
        <>
          <span className="group-hover:hidden">{index}</span>
          <Play className="hidden h-3.5 w-3.5 fill-current group-hover:block" />
        </>
      )}
    </button>
  );
}
