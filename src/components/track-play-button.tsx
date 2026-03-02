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

interface TrackPlayButtonProps {
  index: number;
  audioUrl: string | null;
  status: string;
  onPlayingChange?: (playing: boolean) => void;
}

export function TrackPlayButton({
  index,
  audioUrl,
  status,
  onPlayingChange,
}: TrackPlayButtonProps) {
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

  function handleClick(e: React.MouseEvent) {
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

  const tooltipMessage =
    status === "processing_audio"
      ? "Audio is being generated…"
      : status === "failed"
        ? "Audio generation failed"
        : "Generate audio first";

  if (!canPlay) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className="relative z-10 flex w-8 cursor-not-allowed items-center justify-center text-sm text-muted-foreground/40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span className="hidden sm:inline sm:group-hover:hidden">{index}</span>
            <Play className="h-3.5 w-3.5 fill-current sm:hidden sm:group-hover:block" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (playing) {
    return (
      <button
        onClick={handleClick}
        className="relative z-10 flex w-8 cursor-pointer items-center justify-center text-primary"
      >
        <Pause className="h-3.5 w-3.5 fill-current" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="relative z-10 flex w-8 cursor-pointer items-center justify-center text-sm text-muted-foreground hover:text-foreground"
    >
      <span className="hidden sm:inline sm:group-hover:hidden">{index}</span>
      <Play className="h-3.5 w-3.5 fill-current sm:hidden sm:group-hover:block" />
    </button>
  );
}
