"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StudioUIMessage } from "@/lib/chat/tools";
import type { SoundPreview } from "@/lib/meditation/sound-previews";
import { PreviewButton, usePreviewPlayer } from "@/components/studio/preview-player";

type PreviewSoundsPart = Extract<StudioUIMessage["parts"][number], { type: "tool-previewSounds" }>;

function SoundRow({ sound }: { sound: SoundPreview }) {
  const { state, failed, toggle } = usePreviewPlayer(sound.url);

  return (
    <li className="flex items-center gap-3">
      <PreviewButton label={sound.label} state={state} onClick={toggle} />
      <span className="min-w-0 flex-1 text-sm font-medium">{sound.label}</span>
      {failed ? (
        <span className="text-sm text-candle">Couldn&apos;t play</span>
      ) : (
        <span className="text-sm text-muted-foreground tabular-nums">{sound.seconds}s</span>
      )}
    </li>
  );
}

/** The `previewSounds` tool part: a row per sound, each with a play button and its length. */
export function SoundPreviewCard({ part }: { part: PreviewSoundsPart }) {
  if (part.state === "output-error") {
    return <p className="text-sm text-muted-foreground">The sounds couldn&apos;t be loaded.</p>;
  }
  if (part.state !== "output-available") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
        Finding the sounds...
      </p>
    );
  }

  return (
    <Card>
      <CardContent>
        <ul className="space-y-3" aria-label="Sound previews">
          {part.output.sounds.map((sound) => (
            <SoundRow key={sound.name} sound={sound} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
