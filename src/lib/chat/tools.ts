import {
  tool,
  type InferUITools,
  type ModelMessage,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { findMalformedMarkers, parseMeditationText } from "@/lib/meditation/parser";
import { estimateDuration } from "@/lib/meditation/duration";
import { SOUND_EFFECTS } from "@/lib/meditation/sounds";
import { SOUND_NAMES, soundPreview } from "@/lib/meditation/sound-previews";
import { MEDITATION_TYPES, TAGS } from "@/lib/meditation/tags";
import type { MeditationSettings } from "@/lib/meditation/types";

/**
 * What the route hands each server tool. The client is the caller's
 * RLS-bound server client, never service-role: every write below is one the
 * owner could make themselves.
 */
const studioContextSchema = z.object({
  supabase: z.custom<SupabaseClient>(
    (value) => typeof value === "object" && value !== null,
  ),
  userId: z.string(),
  chatId: z.string(),
});

export type StudioToolContext = z.infer<typeof studioContextSchema>;

/**
 * How far an estimate may sit from the target before the model is told to
 * rewrite: 2 minutes or 15%, whichever is larger. The one place this lives.
 * Tight enough to catch the real misses (long sessions landing at 68-85% of
 * target before task 16's prompt fix), loose enough that an ordinary draft,
 * 91-106% after it, is never rewritten just for timing (task 41).
 */
export const LENGTH_TOLERANCE = { minutes: 2, ratio: 0.15 };

export function lengthToleranceSeconds(targetSeconds: number): number {
  return Math.max(LENGTH_TOLERANCE.minutes * 60, targetSeconds * LENGTH_TOLERANCE.ratio);
}

export const writeScriptInput = z.object({
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(90)
    .describe("The target length in minutes. 10 when the person did not say."),
  script: z
    .string()
    .min(1)
    .max(30000)
    .describe("The complete script in the markup format. Always the whole script, never a fragment."),
});

export const setDetailsInput = z.object({
  title: z.string().trim().min(1).max(80).describe("A short, evocative title."),
  description: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe("One or two sentences on what the meditation is for."),
  tags: z
    .array(z.enum(TAGS))
    .min(2)
    .max(5)
    .describe("2 to 5 tags from the vocabulary."),
  type: z.enum(MEDITATION_TYPES),
  durationMinutes: z.number().int().min(1).max(90),
});

export const previewSoundsInput = z.object({
  sounds: z
    .array(z.enum(SOUND_NAMES))
    .min(1)
    .max(SOUND_NAMES.length)
    .describe("The sound files to play, by file name. Every sound when they ask what is available."),
});

async function linkedMeditationId(ctx: StudioToolContext): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("chats")
    .select("meditation_id")
    .eq("id", ctx.chatId)
    .single();
  if (error || !data) throw new Error("This chat could not be found.");
  return data.meditation_id as string | null;
}

/**
 * Whether an earlier writeScript in this turn was already sent back for its
 * length. `messages` holds this turn's earlier steps, so everything after the
 * last user message is this turn (a continuation adds no user message).
 */
function lengthRewriteAsked(messages: ModelMessage[]): boolean {
  const lastUser = messages.findLastIndex((m) => m.role === "user");
  return messages.slice(lastUser + 1).some(
    (m) =>
      m.role === "tool" &&
      m.content.some(
        (part) =>
          part.type === "tool-result" &&
          part.toolName === "writeScript" &&
          part.output.type === "json" &&
          (part.output.value as { withinTarget?: unknown } | null)?.withinTarget === false,
      ),
  );
}

function reviewScript(script: string, durationMinutes: number, rewriteAsked: boolean) {
  const parsed = parseMeditationText(script);
  const segments = { speech: 0, pause: 0, silence: 0, sound: 0 };
  for (const segment of parsed) segments[segment.type] += 1;

  const malformedLines = findMalformedMarkers(script);
  const unknownSounds = parsed.flatMap((s) =>
    s.type === "sound" && !(s.file in SOUND_EFFECTS) ? [s.file] : [],
  );
  const estimatedSeconds = estimateDuration(script).totalSeconds;
  const targetSeconds = durationMinutes * 60;
  const offBy = estimatedSeconds - targetSeconds;
  const lengthOff = Math.abs(offBy) > lengthToleranceSeconds(targetSeconds);
  const estimatedMinutes = Math.round(estimatedSeconds / 60);

  const issues: string[] = [];
  if (malformedLines.length > 0) {
    issues.push(
      `${malformedLines.length} malformed marker line(s) will be dropped or read aloud. ` +
        "Put each marker alone on its own line in the exact format.",
    );
  }
  if (unknownSounds.length > 0) {
    issues.push(`Unknown sound file(s): ${unknownSounds.join(", ")}. Use only the listed sounds.`);
  }
  // One length rewrite per turn. A second miss is kept as written, and the
  // person hears its real length instead of waiting through another rewrite.
  let note: string | undefined;
  if (lengthOff && !rewriteAsked) {
    issues.push(
      `Runs ${estimatedMinutes} min, ${offBy < 0 ? "well short of" : "well over"} the ` +
        `${durationMinutes} min target. Adjust the SILENCE blocks and write it again, once.`,
    );
  } else if (lengthOff) {
    note =
      `Accepted at ${estimatedMinutes} min. Do not write it again for length; ` +
      `tell the person it runs about ${estimatedMinutes} minutes.`;
  }

  return {
    segments,
    droppedMarkers: malformedLines.length,
    malformedLines: malformedLines.slice(0, 5),
    unknownSounds,
    estimatedSeconds,
    targetSeconds,
    withinTarget: !lengthOff || rewriteAsked,
    issues,
    ...(note && { note }),
  };
}

export const studioTools = {
  writeScript: tool({
    description:
      "Write the whole meditation script into the canvas. Use it for the first draft and for every revision; a revision is a full rewrite. Returns the parsed segment counts, malformed markers and the estimated length against the target.",
    inputSchema: writeScriptInput,
    contextSchema: studioContextSchema,
    execute: async ({ durationMinutes, script }, { context: ctx, messages }) => {
      const review = reviewScript(script, durationMinutes, lengthRewriteAsked(messages));
      let meditationId = await linkedMeditationId(ctx);
      let savedAs: "script" | "draft_script" = "script";

      if (!meditationId) {
        // The first script creates the meditation. Details come from
        // setDetails right after; until then it needs a title to exist.
        const { data, error } = await ctx.supabase
          .from("meditations")
          .insert({
            user_id: ctx.userId,
            title: "Untitled meditation",
            // No prompt: the request lives only in the chat, which is
            // owner-only even when the meditation goes public.
            script,
            status: "script_ready",
            is_public: false,
            settings: { duration: durationMinutes },
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(`Saving the script failed: ${error?.message}`);
        meditationId = data.id as string;

        const { error: linkError } = await ctx.supabase
          .from("chats")
          .update({ meditation_id: meditationId, updated_at: new Date().toISOString() })
          .eq("id", ctx.chatId);
        if (linkError) throw new Error(`Linking the chat failed: ${linkError.message}`);
      } else {
        const [{ data: current, error }, { data: draft, error: draftError }] = await Promise.all([
          ctx.supabase
            .from("meditations")
            .select("audio_path, status, settings")
            .eq("id", meditationId)
            .single(),
          ctx.supabase
            .from("meditation_drafts")
            .select("render_status")
            .eq("meditation_id", meditationId)
            .maybeSingle(),
        ]);
        if (error || !current) throw new Error("The meditation could not be found.");
        if (draftError) throw new Error(`Reading the draft failed: ${draftError.message}`);
        if (current.status === "processing_audio" || draft?.render_status === "processing") {
          throw new Error(
            "Audio is being made from the current script right now. Tell the person to wait until it finishes, then revise.",
          );
        }

        // Once audio exists, the script describes that audio. A revision goes
        // to meditation_drafts, which only the owner can read, until a new
        // render promotes it. A failed render's state carries over to the new
        // revision, so the free retry still applies.
        savedAs = current.audio_path ? "draft_script" : "script";
        const now = new Date().toISOString();
        const { error: writeError } =
          savedAs === "draft_script"
            ? await ctx.supabase
                .from("meditation_drafts")
                .upsert(
                  { meditation_id: meditationId, script, updated_at: now },
                  { onConflict: "meditation_id" },
                )
            : await ctx.supabase
                .from("meditations")
                .update({
                  script,
                  settings: {
                    ...((current.settings as MeditationSettings | null) ?? {}),
                    duration: durationMinutes,
                  },
                  updated_at: now,
                })
                .eq("id", meditationId);
        if (writeError) throw new Error(`Saving the script failed: ${writeError.message}`);
      }

      return { meditationId, savedAs, ...review };
    },
  }),

  setDetails: tool({
    description:
      "Set the meditation's title, a one- or two-sentence description, 2 to 5 tags from the vocabulary, its type and its target length in minutes. Call it after the first script, and again only when one of these should change.",
    inputSchema: setDetailsInput,
    contextSchema: studioContextSchema,
    execute: async ({ title, description, tags, type, durationMinutes }, { context: ctx }) => {
      const meditationId = await linkedMeditationId(ctx);
      if (!meditationId) throw new Error("There is no script yet. Call writeScript first.");

      const { data: current, error } = await ctx.supabase
        .from("meditations")
        .select("audio_path, settings")
        .eq("id", meditationId)
        .single();
      if (error || !current) throw new Error("The meditation could not be found.");

      // Type and length describe the current version. With audio, that is
      // the rendered file, so they wait for the next render.
      const settings = current.audio_path
        ? undefined
        : {
            ...((current.settings as MeditationSettings | null) ?? {}),
            type,
            duration: durationMinutes,
          };
      const uniqueTags = [...new Set(tags)];

      const now = new Date().toISOString();
      const { error: writeError } = await ctx.supabase
        .from("meditations")
        .update({ title, description, tags: uniqueTags, ...(settings && { settings }), updated_at: now })
        .eq("id", meditationId);
      if (writeError) throw new Error(`Saving the details failed: ${writeError.message}`);

      await ctx.supabase.from("chats").update({ title, updated_at: now }).eq("id", ctx.chatId);

      return { meditationId, title, tags: uniqueTags };
    },
  }),

  // Reads nothing and writes nothing: the files are static, under public/sounds/.
  previewSounds: tool({
    description:
      "Show a card with a play button for each named sound, so the person can hear them. Use it when they ask what the sounds are or sound like, or seem unsure which to pick. Not after every script.",
    inputSchema: previewSoundsInput,
    execute: async ({ sounds }) => ({
      sounds: [...new Set(sounds)].map(soundPreview),
    }),
  }),

  // Client-side: no execute. The chat renders it as the voice and make-audio
  // card (task 31), and audio only starts on the owner's click.
  offerAudio: tool({
    description:
      "Show the card where the person picks a voice and makes the audio. Call it once the script is settled. It never starts audio by itself.",
    inputSchema: z.object({}),
    // What the card reports back when the owner acts on it. Task 31 owns the
    // card and may widen this; keep it small, since the model reads it.
    outputSchema: z.object({
      outcome: z.enum(["started", "dismissed"]),
      voice: z.string().optional(),
    }),
  }),
};

export type StudioUITools = InferUITools<typeof studioTools>;

export type StudioUIMessage = UIMessage<unknown, UIDataTypes, StudioUITools>;
