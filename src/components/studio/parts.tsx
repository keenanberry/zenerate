"use client";

import type { ReactNode } from "react";
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
    default:
      return null;
  }
}
