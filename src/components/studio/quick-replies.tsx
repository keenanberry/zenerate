"use client";

import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAKE_AUDIO_REPLY } from "@/lib/chat/replies";

/**
 * The next step under a fresh draft (task 43). "Make the audio" sends itself,
 * and that turn can only offer the audio card (`prepareStudioStep`); "Change
 * something" hands the composer back. `showsQuickReplies` decides when they
 * show. Since task 50 they are real buttons, because making the audio is the
 * most important step in the product, and the first draft adds one line on
 * what else can be asked for.
 */
export function QuickReplies({
  firstDraft,
  onMakeAudio,
  onChange,
}: {
  firstDraft: boolean;
  onMakeAudio: () => void;
  onChange: () => void;
}) {
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Next step" className="flex flex-wrap gap-2">
        <Button type="button" onClick={onMakeAudio} className="gap-2">
          <AudioLines aria-hidden />
          {MAKE_AUDIO_REPLY}
        </Button>
        <Button type="button" variant="outline" onClick={onChange}>
          Change something
        </Button>
      </div>
      {firstDraft && (
        <p className="text-sm text-muted-foreground">
          You can also ask for a different length, another voice or ambient sound.
        </p>
      )}
    </div>
  );
}
