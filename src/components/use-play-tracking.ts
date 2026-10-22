import { useEffect } from "react";

/**
 * Play counting for Popular (task 36). One play is one pass through the
 * audio by a signed-in listener, counted once it has actually been heard for
 * PLAY_THRESHOLD_SECONDS.
 *
 * "Heard" is time accumulated from the element's own timeupdate events, not
 * the playhead: a seek straight to minute five has not been listened to, and
 * a pause and resume is still the same play. A play ends at `ended`, or when
 * a counted play restarts from the top, and the next one counts afresh.
 */
export const PLAY_THRESHOLD_SECONDS = 30;

/** A timeupdate gap wider than this is a seek, not listening. */
const MAX_TICK_SECONDS = 2;

type PlayMedia = Pick<HTMLMediaElement, "currentTime" | "paused"> &
  Pick<EventTarget, "addEventListener" | "removeEventListener">;

/**
 * Calls `onPlay` once per play that passes the threshold. Returns a cleanup
 * that removes every listener.
 */
export function watchPlays(
  media: PlayMedia,
  onPlay: () => void,
  thresholdSeconds = PLAY_THRESHOLD_SECONDS,
): () => void {
  let heard = 0;
  let last: number | null = null;
  let counted = false;

  const reset = () => {
    heard = 0;
    counted = false;
  };

  const handlers: Record<string, () => void> = {
    play: () => {
      if (counted && media.currentTime < 1) reset();
      last = media.currentTime;
    },
    seeked: () => {
      last = media.currentTime;
    },
    timeupdate: () => {
      const now = media.currentTime;
      if (!media.paused && last !== null) {
        const tick = now - last;
        if (tick > 0 && tick <= MAX_TICK_SECONDS) heard += tick;
      }
      last = now;
      if (!counted && heard >= thresholdSeconds) {
        counted = true;
        onPlay();
      }
    },
    ended: () => {
      reset();
      last = null;
    },
  };

  for (const [event, handler] of Object.entries(handlers)) {
    media.addEventListener(event, handler);
  }
  return () => {
    for (const [event, handler] of Object.entries(handlers)) {
      media.removeEventListener(event, handler);
    }
  };
}

/**
 * Binds `watchPlays` to the player's element. `record` is null when the
 * listener is signed out, and then nothing is watched or sent: signed-out
 * plays are not recorded at all.
 */
export function usePlayTracking(
  media: HTMLMediaElement | null,
  record: (() => void) | null,
) {
  useEffect(() => {
    if (!media || !record) return;
    return watchPlays(media, record);
  }, [media, record]);
}
