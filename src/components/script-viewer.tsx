"use client";

import { useMemo } from "react";
import { parseMeditationText } from "@/lib/meditation/parser";
import { formatDuration } from "@/lib/meditation/duration";
import {
  lineState,
  segmentSpans,
  soundName,
  type LineState,
} from "@/lib/meditation/timeline";
import type { MeditationSegment } from "@/lib/meditation/types";
import { useScriptPlayback } from "@/components/script-playback";
import { Bell, Hourglass, Pause, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptViewerProps {
  script: string;
}

/** Slow enough to read as the room dimming, not as a UI state change. */
const FADE = "motion-safe:transition-[color,opacity] motion-safe:duration-700";

const speechTone: Record<LineState, string> = {
  idle: "text-foreground",
  upcoming: "text-foreground/80",
  current: "text-foreground before:opacity-100",
  passed: "text-muted-foreground",
};

const markerTone: Record<LineState, string> = {
  idle: "",
  upcoming: "",
  current: "",
  passed: "opacity-60",
};

type Marker = Exclude<MeditationSegment, { type: "speech" }>;

const markerStyle: Record<
  Marker["type"],
  { label: string; icon: LucideIcon; tone: string }
> = {
  pause: { label: "Pause", icon: Pause, tone: "text-candle" },
  silence: { label: "Silence", icon: Hourglass, tone: "text-periwinkle" },
  sound: { label: "Sound", icon: Bell, tone: "text-sage" },
};

function markerValue(marker: Marker): string {
  return marker.type === "sound"
    ? soundName(marker.file)
    : formatDuration(marker.duration);
}

export function ScriptViewer({ script }: ScriptViewerProps) {
  const segments = useMemo(() => parseMeditationText(script), [script]);
  const playback = useScriptPlayback();
  const duration = playback?.duration ?? 0;
  const spans = useMemo(
    () => segmentSpans(segments, duration),
    [segments, duration],
  );

  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No script content.</p>
    );
  }

  const time = playback?.time ?? 0;
  const started = playback?.started ?? false;

  return (
    // The measure is set on the column in Lora's own `ch`, so markers line up
    // with the passages; markers stay Geist.
    <div className="max-w-[65ch] space-y-6 font-serif text-lg">
      {segments.map((segment, i) => {
        const state = lineState(i, spans, time, started);

        if (segment.type === "speech") {
          return (
            <p
              key={i}
              aria-current={state === "current" ? "true" : undefined}
              className={cn(
                // The bar in the gutter marks the passage being spoken; it
                // sits in the card's padding so the measure is untouched.
                "relative leading-[1.9] text-pretty",
                "before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-0.5 before:rounded-full before:bg-primary before:opacity-0 sm:before:-left-4",
                FADE,
                "motion-safe:before:transition-opacity motion-safe:before:duration-700",
                speechTone[state],
              )}
            >
              {segment.content}
            </p>
          );
        }

        // Markers are instructions to the narrator, not words to read, so
        // they leave the serif for small-caps sans and sit on a hairline.
        const { label, icon: Icon, tone } = markerStyle[segment.type];
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2.5 py-1 font-sans text-xs font-medium select-none",
              FADE,
              markerTone[state],
            )}
          >
            <Icon className={cn("size-3.5 shrink-0", tone)} aria-hidden />
            <span className={cn("uppercase tracking-[0.06em]", tone)}>
              {label}
            </span>
            <span className="truncate tabular-nums text-muted-foreground">
              {markerValue(segment)}
            </span>
            <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
          </div>
        );
      })}
    </div>
  );
}
