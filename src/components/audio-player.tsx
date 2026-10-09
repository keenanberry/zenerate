"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import WaveSurfer from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Pause, Play, Volume2, VolumeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMediaSession,
  watchMediaElement,
} from "@/components/use-media-session";
import { useReportScriptPlayback } from "@/components/script-playback";

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
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function resolveCssColor(cssVar: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
}

/**
 * The waveform's colours, read from the theme tokens. The played portion is
 * the player gradient, laid across the full width so it reaches the rose as
 * the session ends; wavesurfer takes a CanvasGradient in canvas pixels, which
 * is why the width and pixel ratio matter here.
 */
function waveformColors(container: HTMLElement) {
  const start = resolveCssColor("--gradient-start");
  const end = resolveCssColor("--gradient-end");
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, container.clientWidth * pixelRatio);

  let progressColor: string | CanvasGradient = start;
  const ctx = document.createElement("canvas").getContext("2d");
  if (ctx && start && end) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, start);
    gradient.addColorStop(1, end);
    progressColor = gradient;
  }

  return {
    waveColor: resolveCssColor("--track"),
    progressColor,
    cursorColor: end,
  };
}

function hoverColors() {
  return {
    lineColor: resolveCssColor("--muted-foreground"),
    labelBackground: resolveCssColor("--popover"),
    labelColor: resolveCssColor("--popover-foreground"),
  };
}

export function AudioPlayer({
  audioUrl,
  title,
  meditationId,
  canDownload,
}: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  // True from the first play on, so the script keeps the reader's place.
  const [started, setStarted] = useState(false);
  // The <audio> element wavesurfer plays through, for the lock screen.
  const [media, setMedia] = useState<HTMLMediaElement | null>(null);
  // Read when a player is created, so a volume change does not recreate it.
  const volumeRef = useRef(volume);

  useMediaSession(media, title);

  const reportPlayback = useReportScriptPlayback();
  useEffect(() => {
    reportPlayback?.({ time: currentTime, duration, started });
  }, [reportPlayback, currentTime, duration, started]);

  const initWaveSurfer = useCallback(() => {
    if (!containerRef.current) return;

    wavesurferRef.current?.destroy();

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 80,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      // A silence is most of a meditation. Without a floor its bars vanish,
      // and so does any sign of progress through it.
      barMinHeight: 2,
      cursorWidth: 2,
      ...waveformColors(containerRef.current),
      url: audioUrl,
      normalize: true,
      plugins: [
        Hover.create({
          ...hoverColors(),
          lineWidth: 1,
          labelSize: "11px",
        }),
      ],
    });

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setReady(true);
      ws.setVolume(volumeRef.current);
    });

    ws.on("timeupdate", (time) => setCurrentTime(time));
    ws.on("play", () => {
      setIsPlaying(true);
      setStarted(true);
    });
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    watchMediaElement(ws, setMedia);

    wavesurferRef.current = ws;
  }, [audioUrl]);

  useEffect(() => {
    initWaveSurfer();
    return () => {
      wavesurferRef.current?.destroy();
    };
  }, [initWaveSurfer]);

  // Follow the theme and the width without recreating the player (which
  // would drop the playback position). The theme toggle swaps a class on
  // <html>; a resize stretches the canvas the gradient was measured for.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    const recolor = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        wavesurferRef.current?.setOptions(waveformColors(container));
      });
    };
    const themeObserver = new MutationObserver(recolor);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const sizeObserver = new ResizeObserver(recolor);
    sizeObserver.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      sizeObserver.disconnect();
    };
  }, []);

  function togglePlay() {
    wavesurferRef.current?.playPause();
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setMuted(val === 0);
    volumeRef.current = val;
    wavesurferRef.current?.setVolume(val);
  }

  function toggleMute() {
    if (muted) {
      const restored = volume > 0 ? volume : 0.8;
      setMuted(false);
      volumeRef.current = restored;
      wavesurferRef.current?.setVolume(restored);
    } else {
      setMuted(true);
      volumeRef.current = 0;
      wavesurferRef.current?.setVolume(0);
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
              onClick={togglePlay}
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
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                {canDownload ? (
                  <a
                    href={`/api/audio/${meditationId}/download`}
                    aria-label="Download audio"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                ) : (
                  <Link
                    href="/login"
                    aria-label="Sign in to download"
                    title="Sign in to download"
                  >
                    <Download className="h-4 w-4" />
                  </Link>
                )}
              </Button>
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
