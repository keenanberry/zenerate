"use client";

import { MAKE_AUDIO_REPLY } from "@/lib/chat/replies";
import { cn } from "@/lib/utils";

const chip = cn(
  "inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none",
  "hover:bg-card-hover hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "motion-safe:transition-colors",
);

/**
 * Two replies under a fresh draft (task 43). "Make the audio" sends itself,
 * and that turn can only offer the audio card (`prepareStudioStep`); "Change
 * something" hands the composer back. `showsQuickReplies` decides when they
 * show.
 */
export function QuickReplies({
  onMakeAudio,
  onChange,
}: {
  onMakeAudio: () => void;
  onChange: () => void;
}) {
  return (
    <div role="group" aria-label="Quick replies" className="flex flex-wrap gap-2">
      <button type="button" onClick={onMakeAudio} className={chip}>
        {MAKE_AUDIO_REPLY}
      </button>
      <button type="button" onClick={onChange} className={chip}>
        Change something
      </button>
    </div>
  );
}
