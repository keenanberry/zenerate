"use client";

import { parseMeditationText } from "@/lib/meditation/parser";
import { Pause, Volume2, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptViewerProps {
  script: string;
}

export function ScriptViewer({ script }: ScriptViewerProps) {
  const segments = parseMeditationText(script);

  if (segments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No script content.</p>
    );
  }

  return (
    // The measure is set on the column in Lora's own `ch`, so markers line up
    // with the passages; markers stay Geist.
    <div className="max-w-[65ch] space-y-3 font-serif text-lg">
      {segments.map((segment, i) => {
        switch (segment.type) {
          case "speech":
            return (
              <div key={i} className="flex gap-3">
                <MessageSquare className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="leading-[1.9]">{segment.content}</p>
              </div>
            );
          case "pause":
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md font-sans bg-amber-500/10 px-3 py-2 text-sm text-amber-700",
                  "dark:text-amber-400"
                )}
              >
                <Pause className="h-3.5 w-3.5" />
                Pause — {segment.duration} second{segment.duration !== 1 ? "s" : ""}
              </div>
            );
          case "silence":
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md font-sans bg-blue-500/10 px-3 py-2 text-sm text-blue-700",
                  "dark:text-blue-400"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Silence — {Math.round(segment.duration / 60)} minute
                {Math.round(segment.duration / 60) !== 1 ? "s" : ""}
              </div>
            );
          case "sound":
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md font-sans bg-purple-500/10 px-3 py-2 text-sm text-purple-700",
                  "dark:text-purple-400"
                )}
              >
                <Volume2 className="h-3.5 w-3.5" />
                Sound — {segment.file}
              </div>
            );
        }
      })}
    </div>
  );
}
