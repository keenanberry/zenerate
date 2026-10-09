"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Shares the player's position with the script viewer on the meditation page,
 * so the passage being spoken can brighten and passed ones dim.
 *
 * Both sides are optional: a player outside a provider reports to nobody, and
 * a viewer outside one (the create wizard, the script editor) renders evenly
 * lit, as if nothing were playing.
 */

export type ScriptPlayback = {
  /** Seconds into the audio. */
  time: number;
  /** Real length of the audio, 0 until the player knows it. */
  duration: number;
  /** True from the first play on, so pausing keeps the reader's place. */
  started: boolean;
};

type Report = (next: ScriptPlayback) => void;

const PlaybackContext = createContext<ScriptPlayback | null>(null);
const ReportContext = createContext<Report | null>(null);

/**
 * Wavesurfer reports time on every animation frame. A passage lasts seconds,
 * so a quarter-second step is plenty and spares the viewer 60 renders a second.
 */
const TIME_STEP_SECONDS = 0.25;

export function ScriptPlaybackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [playback, setPlayback] = useState<ScriptPlayback>({
    time: 0,
    duration: 0,
    started: false,
  });

  const report = useCallback<Report>((next) => {
    setPlayback((prev) =>
      prev.started === next.started &&
      prev.duration === next.duration &&
      Math.abs(prev.time - next.time) < TIME_STEP_SECONDS
        ? prev
        : next,
    );
  }, []);

  return (
    <ReportContext.Provider value={report}>
      <PlaybackContext.Provider value={playback}>
        {children}
      </PlaybackContext.Provider>
    </ReportContext.Provider>
  );
}

/** The player's position, or null outside a provider. */
export function useScriptPlayback(): ScriptPlayback | null {
  return useContext(PlaybackContext);
}

/** For the player: where to send its position, or null outside a provider. */
export function useReportScriptPlayback(): Report | null {
  return useContext(ReportContext);
}
