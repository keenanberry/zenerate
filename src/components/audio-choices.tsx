"use client";

import { useEffect, useId, useState } from "react";
import { Check, ChevronUp, Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreviewPlayer } from "@/components/studio/preview-player";
import { AMBIENCE_IDS, AMBIENCES, type AmbienceId } from "@/lib/meditation/ambience";
import type { Voice } from "@/lib/voices/catalog";
import { cn } from "@/lib/utils";

/** One voice or bed, as the summary and the list draw it. */
interface Option {
  id: string;
  name: string;
  /** Beside the name in the list: a voice's gender. */
  aside?: string;
  description?: string;
  previewUrl: string | null;
}

/**
 * A labelled preview control. It shares the studio's one-at-a-time player,
 * so starting any preview stops whichever voice, bed or sound was playing.
 */
function ListenButton({ url, name }: { url: string; name: string }) {
  const { state, failed, toggle } = usePreviewPlayer(url);
  const idle = state === "idle";

  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggle}
        aria-pressed={!idle}
        aria-label={idle ? `Listen to ${name}` : `Stop ${name}`}
        className={cn("min-w-[5.5rem]", !idle && "border-primary text-primary")}
      >
        {state === "loading" ? (
          <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
        ) : state === "playing" ? (
          <Square className="size-3 fill-current" aria-hidden />
        ) : (
          <Play className="size-3.5 fill-current" aria-hidden />
        )}
        {idle ? "Listen" : "Stop"}
      </Button>
      {failed && <span className="text-xs text-candle">Couldn&apos;t play</span>}
    </span>
  );
}

/**
 * What is chosen, with Listen and a Change control that opens the full list
 * in place beneath it. The list stays open while the person tries options;
 * Done folds it.
 */
function Choice({
  label,
  options,
  selected,
  note,
  onSelect,
}: {
  label: string;
  options: Option[];
  selected: Option;
  /** Why this was preselected: "Same as last time", "Suggested for this one". */
  note?: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const name = useId();

  return (
    <div className="py-3">
      <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{selected.name}</p>
          {selected.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{selected.description}</p>
          )}
          {note && <p className="mt-0.5 text-xs text-sage">{note}</p>}
        </div>
        {/* Keyed, so a new choice gets a player for its own file. */}
        {selected.previewUrl && (
          <ListenButton key={selected.id} url={selected.previewUrl} name={selected.name} />
        )}
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? undefined : `Change ${label.toLowerCase()}`}
          // Wide enough for "Done" and its chevron, so Listen never shifts.
          className="w-24 shrink-0 justify-end px-2"
        >
          {open ? (
            <>
              Done
              <ChevronUp aria-hidden />
            </>
          ) : (
            "Change"
          )}
        </Button>
      </div>

      {open && (
        <fieldset id={listId} className="mt-2 -mx-2">
          <legend className="sr-only">Choose a {label.toLowerCase()}</legend>
          {options.map((option) => {
            const isSelected = option.id === selected.id;
            return (
              <div
                key={option.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 hover:bg-card-hover motion-safe:transition-colors",
                  "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                  isSelected && "bg-card-hover",
                )}
              >
                {/* Listen sits outside the label, so hearing an option never chooses it. */}
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch">
                  <input
                    type="radio"
                    name={name}
                    value={option.id}
                    checked={isSelected}
                    onChange={() => onSelect(option.id)}
                    className="sr-only"
                  />
                  <Check
                    className={cn("size-4 shrink-0 text-primary", !isSelected && "invisible")}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {option.name}
                      {option.aside && (
                        <span className="font-normal text-muted-foreground"> · {option.aside}</span>
                      )}
                    </span>
                    {option.description && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                </label>
                {option.previewUrl && <ListenButton url={option.previewUrl} name={option.name} />}
              </div>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function voiceOption(voice: Voice): Option {
  return {
    id: voice.voiceId,
    name: voice.name,
    aside: voice.gender === "unknown" ? undefined : capitalize(voice.gender),
    description: voice.description || undefined,
    previewUrl: voice.previewUrl,
  };
}

/** The collection's voices, from /api/voices. */
function useVoices() {
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/voices")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load voices");
        return res.json() as Promise<Voice[]>;
      })
      .then((data) => !cancelled && setVoices(data))
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load voices");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { voices, error };
}

export function VoiceChoice({
  selectedVoiceId,
  note,
  onSelect,
}: {
  selectedVoiceId: string;
  note?: string | null;
  onSelect: (voiceId: string) => void;
}) {
  const { voices, error } = useVoices();
  const known = !voices || voices.some((v) => v.voiceId === selectedVoiceId);

  // A saved voice since removed from the collection: choose the voice shown,
  // so the render uses it rather than one the generate route would refuse.
  useEffect(() => {
    if (!known && voices?.[0]) onSelect(voices[0].voiceId);
  }, [known, voices, onSelect]);

  if (error) {
    return <p className="py-3 text-sm text-destructive">{error}</p>;
  }

  if (!voices) {
    return (
      <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
        Loading voices…
      </p>
    );
  }

  const options = voices.map(voiceOption);
  // The default leads the catalog, so an unknown id still shows a real voice.
  const selected = options.find((o) => o.id === selectedVoiceId) ?? options[0];
  if (!selected) {
    return <p className="py-3 text-sm text-destructive">No voices are available right now.</p>;
  }

  return (
    <Choice
      label="Voice"
      options={options}
      selected={selected}
      note={selected.id === selectedVoiceId ? note : null}
      onSelect={onSelect}
    />
  );
}

const AMBIENCE_OPTIONS: Option[] = AMBIENCE_IDS.map((id) => ({
  id,
  name: AMBIENCES[id].label,
  description: id === "none" ? "Silence under the voice" : undefined,
  previewUrl: AMBIENCES[id].previewUrl,
}));

export function AmbienceChoice({
  selected,
  note,
  onSelect,
}: {
  selected: AmbienceId;
  note?: string | null;
  onSelect: (id: AmbienceId) => void;
}) {
  return (
    <Choice
      label="Background"
      options={AMBIENCE_OPTIONS}
      selected={AMBIENCE_OPTIONS.find((o) => o.id === selected) ?? AMBIENCE_OPTIONS[0]}
      note={note}
      onSelect={(id) => onSelect(id as AmbienceId)}
    />
  );
}
