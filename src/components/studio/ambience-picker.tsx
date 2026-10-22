"use client";

import { useId } from "react";
import { VolumeX } from "lucide-react";
import { AMBIENCE_IDS, AMBIENCES, type Ambience, type AmbienceId } from "@/lib/meditation/ambience";
import { PreviewButton, usePreviewPlayer } from "@/components/studio/preview-player";
import { cn } from "@/lib/utils";

interface AmbiencePickerProps {
  selected: AmbienceId;
  /** The agent's preselection, marked so the person can see where it came from. */
  suggested?: AmbienceId;
  onSelect: (id: AmbienceId) => void;
}

function Tile({
  name,
  ambience,
  selected,
  suggested,
  onSelect,
}: {
  /** The radio group's name, unique per picker so two cards never share a group. */
  name: string;
  ambience: Ambience;
  selected: boolean;
  suggested: boolean;
  onSelect: () => void;
}) {
  // None has no file; its player is never started.
  const { state, failed, toggle } = usePreviewPlayer(ambience.previewUrl ?? "");

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border bg-card p-2 hover:bg-card-hover motion-safe:transition-colors",
        "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
        selected && "border-primary bg-card-hover ring-1 ring-primary/30",
      )}
    >
      {ambience.previewUrl ? (
        <PreviewButton label={ambience.label} state={state} onClick={toggle} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center text-muted-foreground">
          <VolumeX className="size-4" aria-hidden />
        </span>
      )}
      <label className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center self-stretch">
        <input
          type="radio"
          name={name}
          value={ambience.id}
          checked={selected}
          onChange={onSelect}
          className="sr-only"
        />
        <span className="text-sm font-medium leading-tight">{ambience.label}</span>
        {failed ? (
          <span className="text-xs leading-tight text-candle">Couldn&apos;t play</span>
        ) : (
          suggested && <span className="text-xs leading-tight text-muted-foreground">Suggested</span>
        )}
      </label>
    </div>
  );
}

/**
 * The bed under the narration, as a radio group of tiles. Each tile but None
 * has a play button beside its label; the button sits outside the label, so
 * hearing a bed never selects it.
 */
export function AmbiencePicker({ selected, suggested, onSelect }: AmbiencePickerProps) {
  const name = useId();
  return (
    // Columns follow the picker's own width, like the voice picker: the chat
    // column is narrow on any screen.
    <fieldset className="@container">
      <legend className="mb-3 text-sm font-medium">Background</legend>
      <div className="grid grid-cols-2 gap-2 @md:grid-cols-3">
        {AMBIENCE_IDS.map((id) => (
          <Tile
            key={id}
            name={name}
            ambience={AMBIENCES[id]}
            selected={selected === id}
            suggested={suggested === id}
            onSelect={() => onSelect(id)}
          />
        ))}
      </div>
    </fieldset>
  );
}
