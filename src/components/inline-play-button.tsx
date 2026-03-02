"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

let activeAudio: HTMLAudioElement | null = null;
let activeCleanup: (() => void) | null = null;

interface InlinePlayButtonProps {
  audioUrl: string | null;
  status: string;
  size?: "sm" | "md";
  className?: string;
}

export function InlinePlayButton({
  audioUrl,
  status,
  size = "sm",
  className,
}: InlinePlayButtonProps) {
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
  }, []);

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
  }

  const tooltipMessage =
    status === "processing_audio"
      ? "Audio is being generated…"
      : status === "failed"
        ? "Audio generation failed"
        : "Generate audio first";

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  if (!canPlay) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className={cn(
              "inline-flex items-center justify-center rounded-md cursor-not-allowed text-muted-foreground/40",
              btnSize,
              className,
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Play className={cn(iconSize, "fill-current")} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltipMessage}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        btnSize,
        "shrink-0",
        playing ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={handleClick}
    >
      {playing ? (
        <Pause className={cn(iconSize, "fill-current")} />
      ) : (
        <Play className={cn(iconSize, "fill-current")} />
      )}
    </Button>
  );
}

export function useIsPlaying() {
  return activeAudio !== null && !activeAudio.paused;
}
