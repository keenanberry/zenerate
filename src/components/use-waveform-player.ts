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
import type { Waveform } from "@/lib/meditation/types";

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

/**
 * The element a player with peaks streams through (task 60). wavesurfer only
 * creates and fetches into its own element; handed this one, it draws the
 * peaks and sets `src`, and the browser fetches by range as it plays.
 * `preload="metadata"` keeps Chrome from buffering ahead on page load, so a
 * visit that never presses play downloads next to nothing.
 *
 * It goes inside the waveform's container, so it is in the document as
 * wavesurfer's own element is (an <audio> without controls takes no space).
 */
function streamingElement(container: HTMLElement): HTMLAudioElement {
  const media = document.createElement("audio");
  media.preload = "metadata";
  container.appendChild(media);
  return media;
}

/**
 * wavesurfer leaves an element it was handed alone when destroyed, so stop
 * it here: without this, a closed player plays on and keeps its connection.
 */
function releaseElement(media: HTMLAudioElement) {
  media.pause();
  media.removeAttribute("src");
  media.load();
  media.remove();
}

/** At most one fresh URL a minute, so a file that is really gone cannot loop. */
const REFRESH_INTERVAL_MS = 60_000;

/** A play pressed this recently still counts when the element fails to load. */
const PLAY_INTENT_MS = 15_000;

/**
 * Keep a streaming element playing past its signed URL (4 hours,
 * AUDIO_URL_TTL_SECONDS). It fetches by range on play, on a seek and on a
 * resume, so a page left open, or a long pause, outlives the URL, and the
 * next request fails. On that error, ask for a fresh URL and carry on from
 * the same place, playing again if it was playing or a play was just
 * pressed. The old path never needed this: it held the whole file as a blob.
 */
function recoverExpiredUrl(
  media: HTMLAudioElement,
  refresh: () => (() => Promise<string | null>) | undefined,
  playRequestedAt: () => number,
): () => void {
  let refreshedAt = -Infinity;
  let disposed = false;
  const onError = async () => {
    const fresh = refresh();
    if (!fresh || Date.now() - refreshedAt < REFRESH_INTERVAL_MS) return;
    refreshedAt = Date.now();
    const position = media.currentTime;
    const resume = !media.paused || Date.now() - playRequestedAt() < PLAY_INTENT_MS;
    const url = await fresh().catch(() => null);
    if (!url || disposed) return;
    media.addEventListener(
      "loadedmetadata",
      () => {
        if (position > 0) media.currentTime = position;
        if (resume) void media.play().catch(() => {});
      },
      { once: true },
    );
    media.src = url;
  };
  media.addEventListener("error", onError);
  return () => {
    disposed = true;
    media.removeEventListener("error", onError);
  };
}

type Shape = Pick<
  WaveSurferOptions,
  "height" | "barWidth" | "barGap" | "barRadius" | "cursorWidth" | "dragToSeek"
>;

export function useWaveformPlayer({
  audioUrl,
  waveform,
  refreshUrl,
  title,
  meditationId,
  coverUrl,
  trackPlays,
  shape,
  hover,
}: {
  audioUrl: string;
  /**
   * Peaks read from the mix when it was rendered (task 60). With them the
   * waveform draws at once and the audio streams on play. Without them, for
   * a render from before peaks, wavesurfer downloads the whole file on load
   * to decode it.
   */
  waveform?: Waveform | null;
  /**
   * A fresh signed URL for the same audio, for when a streaming player's
   * URL has expired (see recoverExpiredUrl).
   */
  refreshUrl?: () => Promise<string | null>;
  /** Shown on the lock screen and in the OS media controls. */
  title: string;
  meditationId: string;
  /** The generated cover, for the lock screen; without one it shows the app's icon. */
  coverUrl?: string | null;
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
  // Read when an expired URL needs replacing, so a new callback does not
  // recreate the player.
  const refreshRef = useRef(refreshUrl);
  useEffect(() => {
    refreshRef.current = refreshUrl;
  }, [refreshUrl]);
  // When play was last pressed, so a play that failed on an expired URL
  // resumes once a fresh one loads.
  const playRequestedAtRef = useRef(-Infinity);

  useMediaSession(media, title, coverUrl);

  // True once a play has passed the listening threshold on this page, so a
  // seek to the end does not count as having listened (the rating prompt).
  const [heard, setHeard] = useState(false);
  const record = useCallback(() => {
    setHeard(true);
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

    const media = waveform ? streamingElement(container) : null;
    const ws = WaveSurfer.create({
      container,
      // A silence is most of a meditation. Without a floor its bars vanish,
      // and so does any sign of progress through it.
      barMinHeight: 2,
      ...shapeRef.current,
      ...waveformColors(container),
      url: audioUrl,
      ...(media && waveform
        ? {
            media,
            // Stored as percents; wavesurfer takes 0..1.
            peaks: [waveform.peaks.map((p) => p / 100)],
            duration: waveform.duration,
          }
        : {}),
      // Scales the tallest bar to full height, whether the bars come from
      // the peaks or from the decoded file, so both draw the same.
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
    const stopRecovering = media
      ? recoverExpiredUrl(
          media,
          () => refreshRef.current,
          () => playRequestedAtRef.current,
        )
      : null;

    wavesurferRef.current = ws;
    return () => {
      stopRecovering?.();
      ws.destroy();
      if (media) releaseElement(media);
      wavesurferRef.current = null;
    };
  }, [audioUrl, waveform, hover]);

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
  // keeps the user gesture iOS needs to start audio. With peaks the element
  // starts streaming there; without them it can play before the waveform has
  // decoded, and only the bars are missing.
  const play = useCallback(() => {
    playRequestedAtRef.current = Date.now();
    void wavesurferRef.current?.play().catch(() => {});
  }, []);
  const togglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (ws && !ws.isPlaying()) playRequestedAtRef.current = Date.now();
    void ws?.playPause().catch(() => {});
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
    heard,
    play,
    togglePlay,
    skip,
    setVolume,
  };
}
