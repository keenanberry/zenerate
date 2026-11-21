"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AudioCard } from "./audio-card";
import { SoundPreviewCard } from "./sound-preview-card";
import type { StudioPart } from "./drafts";
import { useStudio } from "./studio-context";

/** Hands the card the chat it belongs to, so `renderStudioPart` stays one argument. */
function AudioCardSlot({ part }: { part: Extract<StudioPart, { type: "tool-offerAudio" }> }) {
  const { chatId, meditationId, addToolOutput } = useStudio();
  return (
    <AudioCard part={part} chatId={chatId} meditationId={meditationId} addToolOutput={addToolOutput} />
  );
}

/**
 * A quiet line while makeCover runs, so a phone, where the canvas is a
 * closed sheet, still shows something is happening. Nothing once it ends:
 * the canvas shows the cover, and the agent says in a sentence if it failed.
 */
function CoverProgress({ part }: { part: Extract<StudioPart, { type: "tool-makeCover" }> }) {
  const { status } = useStudio();
  const live = status === "submitted" || status === "streaming";
  if (!live || (part.state !== "input-streaming" && part.state !== "input-available")) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
      Making a cover
    </p>
  );
}

/**
 * The chat's cards: tool parts that render as something to act on rather
 * than as text or a draft chip. Tasks 31 and 34 add their cases here; a part
 * with no case renders nothing.
 */
export function renderStudioPart(part: StudioPart): ReactNode | null {
  switch (part.type) {
    case "tool-offerAudio":
      return <AudioCardSlot part={part} />;
    case "tool-previewSounds":
      return <SoundPreviewCard part={part} />;
    case "tool-makeCover":
      return <CoverProgress part={part} />;
    default:
      return null;
  }
}
