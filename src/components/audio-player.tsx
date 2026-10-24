"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Pause, Play, Volume2, VolumeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatTime,
  useWaveformPlayer,
} from "@/components/use-waveform-player";

interface AudioPlayerProps {
  audioUrl: string;
  /** Shown on the lock screen and in the OS media controls. */
  title: string;
  /**
   * Needed for the download link. The player deliberately does NOT download
   * `audioUrl` directly: that is a signed URL to a private bucket, and iOS
   * Safari ignores the `download` attribute on cross-origin links -- it
   * navigates to the file instead of saving it, which is useless on the phone
   * this feature exists for. The route streams it back from our own origin
   * with Content-Disposition instead.
   */
  meditationId: string;
  /**
   * Downloads are for signed-in users. Signed out, the button becomes a
   * sign-in prompt in the same spot; the route enforces this independently.
   */
  canDownload: boolean;
  /**
   * Count plays past 30 seconds toward Popular. Only for a signed-in
   * listener: signed out, nothing is recorded or sent.
   */
  trackPlays?: boolean;
  /** Where Download points. Defaults to the current version's audio. */
  downloadHref?: string;
}

/**
 * The card player, for the studio and earlier versions. The meditation page
 * plays through the session view instead (`session-player.tsx`).
 */
export function AudioPlayer({
  audioUrl,
  title,
  meditationId,
  canDownload,
  trackPlays = false,
  downloadHref = `/api/audio/${meditationId}/download`,
}: AudioPlayerProps) {
  const player = useWaveformPlayer({
    audioUrl,
    title,
    meditationId,
    trackPlays,
    shape: { height: 80, barWidth: 3, barGap: 2, barRadius: 3, cursorWidth: 2 },
    hover: true,
  });
  const { containerRef, isPlaying, currentTime, duration, ready } = player;
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setMuted(val === 0);
    player.setVolume(val);
  }

  function toggleMute() {
    if (muted) {
      const restored = volume > 0 ? volume : 0.8;
      setMuted(false);
      player.setVolume(restored);
    } else {
      setMuted(true);
      player.setVolume(0);
    }
  }

  return (
    // The halo is the one lit thing on the page: a radial glow in dark, a
    // flat tint in light (`--player-halo`). It is larger in dark because a
    // glow fades out before its box does; the tint is drawn edge to edge.
    <div className="relative isolate">
      <div
        aria-hidden
        className="player-halo pointer-events-none absolute -inset-2 -z-10 rounded-3xl sm:-inset-4 dark:-inset-x-4 dark:-inset-y-10 dark:sm:-inset-x-14 dark:sm:-inset-y-16"
      />
      <Card className="dark:bg-card/90">
        <CardContent className="space-y-6">
          <div
            ref={containerRef}
            className={cn(
              "w-full cursor-pointer rounded-md",
              !ready && "bg-muted motion-safe:animate-pulse",
            )}
            style={{ minHeight: 80 }}
          />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={player.togglePlay}
              disabled={!ready}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-gradient-start to-gradient-end text-gradient-foreground outline-none hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-safe:transition-[filter,transform] motion-safe:active:scale-95"
            >
              {isPlaying ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 translate-x-0.5 fill-current" />
              )}
            </button>

            <span className="min-w-[80px] text-sm tabular-nums text-muted-foreground">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex flex-1" />

            <div className="flex items-center gap-1 sm:gap-2">
              {/* A real link, not an onClick fetch: the browser's own download
                  handling is what works across desktop and mobile, and it keeps
                  the several-megabyte response out of JS memory entirely. The
                  filename comes from the route's Content-Disposition header, so
                  no `download` attribute is needed -- and relying on the header
                  is what makes it work on iOS Safari. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                    {canDownload ? (
                      <a
                        href={downloadHref}
                        aria-label="Download audio"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    ) : (
                      <Link href="/login" aria-label="Sign in to download">
                        <Download className="h-4 w-4" />
                      </Link>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {canDownload ? "Download" : "Sign in to download"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={toggleMute}
                    aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
                  >
                    {muted || volume === 0 ? (
                      <VolumeOff className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {muted || volume === 0 ? "Unmute" : "Mute"}
                </TooltipContent>
              </Tooltip>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-track accent-primary sm:block"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
