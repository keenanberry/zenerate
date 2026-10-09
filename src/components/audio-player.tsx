"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import WaveSurfer from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Pause, Play, Volume2, VolumeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMediaSession } from "@/components/use-media-session";

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

function resolveCssColor(cssVar: string, fallback: string): string {
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  return val || fallback;
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
  // The <audio> element wavesurfer plays through. It lives in wavesurfer's
  // shadow root, so it is in the document (and survives a backgrounded tab)
  // without appearing in getElementsByTagName("audio").
  const [media, setMedia] = useState<HTMLMediaElement | null>(null);
  // Read when a player is created, so a volume change does not recreate it.
  const volumeRef = useRef(volume);

  useMediaSession(media, title);

  const initWaveSurfer = useCallback(() => {
    if (!containerRef.current) return;

    wavesurferRef.current?.destroy();

    const progressColor = resolveCssColor("--primary", "#7c3aed");
    const waveColor = resolveCssColor("--border", "#d4d4d8");
    const cursorColor = resolveCssColor("--primary", "#7c3aed");

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 80,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      cursorWidth: 2,
      cursorColor,
      waveColor,
      progressColor,
      url: audioUrl,
      normalize: true,
      plugins: [
        Hover.create({
          lineColor: cursorColor,
          lineWidth: 1,
          labelBackground: "rgba(0, 0, 0, 0.75)",
          labelColor: "#fff",
          labelSize: "11px",
        }),
      ],
    });

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setReady(true);
      setMedia(ws.getMediaElement());
      ws.setVolume(volumeRef.current);
    });

    ws.on("timeupdate", (time) => setCurrentTime(time));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    wavesurferRef.current = ws;
  }, [audioUrl]);

  useEffect(() => {
    initWaveSurfer();
    return () => {
      wavesurferRef.current?.destroy();
      setMedia(null);
    };
  }, [initWaveSurfer]);

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
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div
          ref={containerRef}
          className={cn(
            "w-full cursor-pointer rounded-md",
            !ready && "animate-pulse bg-muted",
          )}
          style={{ minHeight: 80 }}
        />

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            onClick={togglePlay}
            disabled={!ready}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 translate-x-0.5" />
            )}
          </Button>

          <span className="min-w-[80px] text-xs tabular-nums text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex flex-1" />

          <div className="flex items-center gap-2">
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
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
