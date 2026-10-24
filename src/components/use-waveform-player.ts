"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer, { type WaveSurferOptions } from "wavesurfer.js";
import Hover from "wavesurfer.js/dist/plugins/hover.esm.js";
import {
  useMediaSession,
  watchMediaElement,
} from "@/components/use-media-session";
import { useReportScriptPlayback } from "@/components/script-playback";
import { usePlayTracking } from "@/components/use-play-tracking";
import { recordPlay } from "@/lib/meditation/actions";

/**
 * One wavesurfer instance and everything bound to the element it plays
 * through: the lock screen (task 25), play counting and the script sync. The
 * card player (`AudioPlayer`) and the session view (`SessionPlayer`) are two
 * skins over this hook, so neither can drift from the other on what the
 * element does.
 */

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Read from the waveform's own element, not <html>: the session view is dark
 * in either theme, so the tokens in force there are the subtree's.
 */
function resolveCssColor(el: HTMLElement, cssVar: string): string {
  return getComputedStyle(el).getPropertyValue(cssVar).trim();
}

/**
 * The waveform's colours, read from the theme tokens. The played portion is
 * the player gradient, laid across the full width so it reaches the rose as
 * the session ends; wavesurfer takes a CanvasGradient in canvas pixels, which
 * is why the width and pixel ratio matter here.
 */
function waveformColors(container: HTMLElement) {
  const start = resolveCssColor(container, "--gradient-start");
  const end = resolveCssColor(container, "--gradient-end");
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
    waveColor: resolveCssColor(container, "--track"),
    progressColor,
    cursorColor: end,
  };
}

function hoverColors(container: HTMLElement) {
  return {
    lineColor: resolveCssColor(container, "--muted-foreground"),
    labelBackground: resolveCssColor(container, "--popover"),
    labelColor: resolveCssColor(container, "--popover-foreground"),
  };
}

type Shape = Pick<
  WaveSurferOptions,
  "height" | "barWidth" | "barGap" | "barRadius" | "cursorWidth" | "dragToSeek"
>;

export function useWaveformPlayer({
  audioUrl,
  title,
  meditationId,
  trackPlays,
  shape,
  hover,
}: {
  audioUrl: string;
  /** Shown on the lock screen and in the OS media controls. */
  title: string;
  meditationId: string;
  /**
   * Count plays past 30 seconds toward Popular. Only for a signed-in
   * listener: signed out, nothing is recorded or sent.
   */
  trackPlays: boolean;
  shape: Shape;
  /** The time-under-the-pointer line. A mouse affordance; touch has none. */
  hover: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  // True from the first play on, so the script keeps the reader's place.
  const [started, setStarted] = useState(false);
  // The <audio> element wavesurfer plays through, for the lock screen.
  const [media, setMedia] = useState<HTMLMediaElement | null>(null);
  // Read when a player is created, so a volume change does not recreate it.
  const volumeRef = useRef(0.8);
  // Read once at creation; the shape is fixed for a given player.
  const shapeRef = useRef(shape);

  useMediaSession(media, title);

  const record = useCallback(() => {
    void recordPlay(meditationId).catch(() => {});
  }, [meditationId]);
  usePlayTracking(media, trackPlays ? record : null);

  const reportPlayback = useReportScriptPlayback();
  useEffect(() => {
    reportPlayback?.({ time: currentTime, duration, started });
  }, [reportPlayback, currentTime, duration, started]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      // A silence is most of a meditation. Without a floor its bars vanish,
      // and so does any sign of progress through it.
      barMinHeight: 2,
      ...shapeRef.current,
      ...waveformColors(container),
      url: audioUrl,
      normalize: true,
      plugins: hover
        ? [
            Hover.create({
              ...hoverColors(container),
              lineWidth: 1,
              labelSize: "11px",
            }),
          ]
        : [],
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
    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [audioUrl, hover]);

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

  // play() reaches media.play() synchronously, so calling these from a tap
  // keeps the user gesture iOS needs to start audio. Before the waveform has
  // decoded, the element can already play; only the bars are missing.
  const play = useCallback(() => {
    void wavesurferRef.current?.play().catch(() => {});
  }, []);
  const togglePlay = useCallback(() => {
    void wavesurferRef.current?.playPause().catch(() => {});
  }, []);
  const skip = useCallback((seconds: number) => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const end = ws.getDuration();
    const target = Math.max(0, ws.getCurrentTime() + seconds);
    ws.setTime(end > 0 ? Math.min(target, end) : target);
  }, []);
  const setVolume = useCallback((volume: number) => {
    volumeRef.current = volume;
    wavesurferRef.current?.setVolume(volume);
  }, []);

  return {
    containerRef,
    isPlaying,
    currentTime,
    duration,
    ready,
    started,
    play,
    togglePlay,
    skip,
    setVolume,
  };
}
