import { useEffect } from "react";

/**
 * Lock-screen and OS media controls for the meditation player, via the Media
 * Session API.
 *
 * It binds to the HTMLMediaElement that actually plays the audio, not to
 * wavesurfer: the element is the one surface every browser and OS control
 * understands, and wavesurfer already follows it (its waveform and our React
 * state update from the element's own play/pause/timeupdate events). Keeping
 * this out of the player's markup also means a restyle of the player can
 * leave it untouched.
 */

/** Lock-screen skip interval. Long enough to matter in a 20-minute session. */
export const SEEK_OFFSET_SECONDS = 15;

/**
 * Icons from the icon set (task 23). iOS picks the size it needs; the 512px
 * one alone is enough, the 192px one saves a download where a small tile is
 * all that is shown.
 */
export const MEDIA_ARTWORK: MediaImage[] = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
];

export function mediaMetadataInit(title: string): MediaMetadataInit {
  return { title, artist: "Zenerate", artwork: MEDIA_ARTWORK };
}

/** Clamp a seek target into the playable range. */
export function clampTime(time: number, duration: number): number {
  const floored = Math.max(0, time);
  return Number.isFinite(duration) && duration > 0
    ? Math.min(floored, duration)
    : floored;
}

/**
 * The position the OS seekbar should show, or null while the duration is
 * unknown. `setPositionState` throws on a NaN or infinite duration, and on a
 * position past the end, so both are filtered here.
 */
export function positionStateFor(
  media: Pick<HTMLMediaElement, "duration" | "currentTime" | "playbackRate">,
): MediaPositionState | null {
  const { duration, currentTime, playbackRate } = media;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  return {
    duration,
    position: clampTime(currentTime, duration),
    // A paused element still reports its rate; 0 would also throw.
    playbackRate: playbackRate > 0 ? playbackRate : 1,
  };
}

/**
 * `previoustrack` and `nexttrack` are deliberately absent: there is no queue,
 * and a handler for either puts a dead skip button on the lock screen.
 */
const HANDLED_ACTIONS = [
  "play",
  "pause",
  "seekbackward",
  "seekforward",
  "seekto",
] as const satisfies readonly MediaSessionAction[];

/**
 * Point the Media Session at `media`. Returns a cleanup that unbinds
 * everything, so a disposed player never keeps lock-screen controls.
 */
export function bindMediaSession(
  session: MediaSession,
  media: HTMLMediaElement,
  title: string,
): () => void {
  if (typeof MediaMetadata !== "undefined") {
    session.metadata = new MediaMetadata(mediaMetadataInit(title));
  }

  function seekTo(time: number, fast = false) {
    const target = clampTime(time, media.duration);
    if (fast && typeof media.fastSeek === "function") {
      media.fastSeek(target);
    } else {
      media.currentTime = target;
    }
  }

  const handlers: Record<(typeof HANDLED_ACTIONS)[number], MediaSessionActionHandler> = {
    // play() rejects if the browser refuses (no prior user gesture); the OS
    // control simply does nothing then, which is the right outcome.
    play: () => void media.play().catch(() => {}),
    pause: () => media.pause(),
    seekbackward: (d) =>
      seekTo(media.currentTime - (d.seekOffset ?? SEEK_OFFSET_SECONDS)),
    seekforward: (d) =>
      seekTo(media.currentTime + (d.seekOffset ?? SEEK_OFFSET_SECONDS)),
    seekto: (d) => {
      if (d.seekTime != null) seekTo(d.seekTime, d.fastSeek);
    },
  };

  for (const action of HANDLED_ACTIONS) {
    setHandler(session, action, handlers[action]);
  }

  function syncPlaybackState() {
    session.playbackState = media.paused ? "paused" : "playing";
  }

  function syncPosition() {
    const state = positionStateFor(media);
    if (!state) return;
    try {
      session.setPositionState?.(state);
    } catch {
      // Older Safari throws on edge values; the seekbar is a nicety.
    }
  }

  const listeners: [string, () => void][] = [
    ["play", syncPlaybackState],
    ["pause", syncPlaybackState],
    ["ended", syncPlaybackState],
    ["play", syncPosition],
    ["pause", syncPosition],
    ["seeked", syncPosition],
    ["ratechange", syncPosition],
    ["durationchange", syncPosition],
    ["loadedmetadata", syncPosition],
  ];
  for (const [event, fn] of listeners) media.addEventListener(event, fn);

  syncPlaybackState();
  syncPosition();

  return () => {
    for (const [event, fn] of listeners) media.removeEventListener(event, fn);
    for (const action of HANDLED_ACTIONS) setHandler(session, action, null);
    session.metadata = null;
    session.playbackState = "none";
    try {
      session.setPositionState?.();
    } catch {
      // Nothing to clear.
    }
  };
}

/** A browser that does not support an action throws rather than ignoring it. */
function setHandler(
  session: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    session.setActionHandler(action, handler);
  } catch {
    // Unsupported action on this browser; skip it.
  }
}

/**
 * Bind the Media Session to `media` for as long as it is mounted, and rebind
 * when the element or the title changes. A no-op where `mediaSession` does
 * not exist.
 */
export function useMediaSession(media: HTMLMediaElement | null, title: string) {
  useEffect(() => {
    if (!media || typeof navigator === "undefined") return;
    if (!("mediaSession" in navigator)) return;
    return bindMediaSession(navigator.mediaSession, media, title);
  }, [media, title]);
}
