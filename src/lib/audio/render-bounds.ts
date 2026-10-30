import { z } from "zod";
import { parseMeditationText } from "@/lib/meditation/parser";
import { EFFECTIVE_WORDS_PER_MINUTE } from "@/lib/meditation/duration";
import { SOUND_EFFECTS } from "@/lib/meditation/sounds";
import { savedAmbience, type AmbienceId } from "@/lib/meditation/ambience";
import type { MeditationSegment } from "@/lib/meditation/types";

/**
 * What one render may cost, checked on the server before a generation is
 * reserved (the generate route) and again on what the sandbox is actually
 * handed (the workflow's fetchAndParse), since the owner can still edit the
 * script and settings between the two.
 *
 * Deliberately NOT imported by generate-audio.ts, so it is not baked into the
 * sandbox snapshot and takes effect on deploy.
 *
 * The quota counts renders, assuming ~930 speech characters each
 * (src/lib/audio/quota.ts), so speech is what has to be bounded. The studio
 * prompt asks for 2-5 minutes of narration even at 60 minutes long, about
 * 1,500-3,500 characters; 6,000 is ~8 minutes of narration at the TTS pace,
 * comfortably above any house meditation.
 */
export const MAX_SCRIPT_CHARACTERS = 30000;
export const MAX_SPEECH_CHARACTERS = 6000;
/** The prompt asks for 3-15 second pauses. */
export const MAX_PAUSE_SECONDS = 60;
/** The prompt asks for 1-30 minute silences, in blocks of 5-10. */
export const MAX_SILENCE_MINUTES = 30;
/** The studio offers up to 90 minutes; this leaves room for its tolerance. */
export const MAX_TOTAL_MINUTES = 120;

/** A sound marker names a file in the snapshot's sounds folder, never a path. */
const PLAIN_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type RenderScriptCheck =
  | { ok: true; segments: MeditationSegment[] }
  | { ok: false; error: string };

/**
 * Parse a script for rendering and refuse one outside the bounds above. A
 * sound that is not in the catalog is dropped: the sandbox would play a
 * second of silence for it anyway. A sound marker that names a path is
 * refused, since generate-audio.ts joins it onto its sounds folder.
 */
export function checkRenderScript(script: string): RenderScriptCheck {
  if (script.length > MAX_SCRIPT_CHARACTERS) {
    return { ok: false, error: `The script is over ${MAX_SCRIPT_CHARACTERS} characters.` };
  }

  const segments: MeditationSegment[] = [];
  let speechCharacters = 0;
  let words = 0;
  let seconds = 0;
  for (const segment of parseMeditationText(script)) {
    if (segment.type === "speech") {
      speechCharacters += segment.content.length;
      words += segment.content.split(/\s+/).filter(Boolean).length;
    } else if (segment.type === "pause") {
      if (segment.duration > MAX_PAUSE_SECONDS) {
        return { ok: false, error: `A pause can be at most ${MAX_PAUSE_SECONDS} seconds.` };
      }
      seconds += segment.duration;
    } else if (segment.type === "silence") {
      if (segment.duration > MAX_SILENCE_MINUTES * 60) {
        return { ok: false, error: `A silence can be at most ${MAX_SILENCE_MINUTES} minutes.` };
      }
      seconds += segment.duration;
    } else if (segment.type === "sound") {
      if (!PLAIN_FILE_NAME.test(segment.file) || segment.file.includes("..")) {
        return { ok: false, error: "A sound marker must name one of the sounds." };
      }
      const length = (SOUND_EFFECTS as Record<string, number>)[segment.file];
      if (length === undefined) continue;
      seconds += length;
    }
    segments.push(segment);
  }

  if (speechCharacters === 0) {
    return { ok: false, error: "The script has nothing to narrate." };
  }
  if (speechCharacters > MAX_SPEECH_CHARACTERS) {
    return {
      ok: false,
      error: `The narration is over ${MAX_SPEECH_CHARACTERS} characters. Shorten the spoken parts and let silence carry the length.`,
    };
  }
  seconds += (words / EFFECTIVE_WORDS_PER_MINUTE) * 60;
  if (seconds > MAX_TOTAL_MINUTES * 60) {
    return { ok: false, error: `The meditation is too long; it can run at most ${MAX_TOTAL_MINUTES} minutes.` };
  }
  return { ok: true, segments };
}

/**
 * settings is jsonb the owner can write, and the workflow hands voice, bed
 * and volume to the sandbox, where the volume is spliced into an FFmpeg
 * filter graph. So: the volume a finite number, clamped to [0, 1]; the bed
 * one of the catalog's, and a bed it does not know (a retired one, like
 * brown-noise) reads as none, as it always has, since it is only ever a key
 * into AMBIENCES; the voice a string, checked against the voice collection by
 * the generate route. Null reads as unset.
 */
const renderSettingsSchema = z.object({
  voice: z.string().nullish(),
  music: z.string().nullish(),
  volume: z.number().finite().nullish(),
});

export type RenderSettings = { voice?: string; music?: AmbienceId; volume?: number };

export function checkRenderSettings(
  settings: unknown,
): { ok: true; settings: RenderSettings } | { ok: false } {
  const parsed = renderSettingsSchema.safeParse(settings ?? {});
  if (!parsed.success) return { ok: false };

  const { voice, volume } = parsed.data;
  const music = savedAmbience(parsed.data.music);
  return {
    ok: true,
    settings: {
      ...(voice != null && { voice }),
      ...(music != null && { music }),
      ...(volume != null && { volume: Math.min(1, Math.max(0, volume)) }),
    },
  };
}
