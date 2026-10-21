import { tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { findMalformedMarkers, parseMeditationText } from "@/lib/meditation/parser";
import { estimateDuration } from "@/lib/meditation/duration";
import { SOUND_EFFECTS } from "@/lib/meditation/sounds";
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
  /** The chat's first user message, stored as the meditation's `prompt`. */
  prompt: z.string().nullable(),
});

export type StudioToolContext = z.infer<typeof studioContextSchema>;

/** How far an estimate may sit from the target before the model is told to fix it. */
const LENGTH_TOLERANCE = 0.1;

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

async function linkedMeditationId(ctx: StudioToolContext): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("chats")
    .select("meditation_id")
    .eq("id", ctx.chatId)
    .single();
  if (error || !data) throw new Error("This chat could not be found.");
  return data.meditation_id as string | null;
}

function reviewScript(script: string, durationMinutes: number) {
  const parsed = parseMeditationText(script);
  const segments = { speech: 0, pause: 0, silence: 0, sound: 0 };
  for (const segment of parsed) segments[segment.type] += 1;

  const malformedLines = findMalformedMarkers(script);
  const unknownSounds = parsed.flatMap((s) =>
    s.type === "sound" && !(s.file in SOUND_EFFECTS) ? [s.file] : [],
  );
  const estimatedSeconds = estimateDuration(script).totalSeconds;
  const targetSeconds = durationMinutes * 60;
  const ratio = estimatedSeconds / targetSeconds;

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
  if (Math.abs(ratio - 1) > LENGTH_TOLERANCE) {
    const pct = Math.round(Math.abs(ratio - 1) * 100);
    issues.push(
      `Runs ${Math.round(estimatedSeconds / 60)} min, ${pct}% ${ratio < 1 ? "short of" : "over"} ` +
        `the ${durationMinutes} min target. Adjust the SILENCE blocks and write it again.`,
    );
  }

  return {
    segments,
    droppedMarkers: malformedLines.length,
    malformedLines: malformedLines.slice(0, 5),
    unknownSounds,
    estimatedSeconds,
    targetSeconds,
    withinTarget: Math.abs(ratio - 1) <= LENGTH_TOLERANCE,
    issues,
  };
}

export const studioTools = {
  writeScript: tool({
    description:
      "Write the whole meditation script into the canvas. Use it for the first draft and for every revision; a revision is a full rewrite. Returns the parsed segment counts, malformed markers and the estimated length against the target.",
    inputSchema: writeScriptInput,
    contextSchema: studioContextSchema,
    execute: async ({ durationMinutes, script }, { context: ctx }) => {
      const review = reviewScript(script, durationMinutes);
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
            prompt: ctx.prompt,
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
        const { data: current, error } = await ctx.supabase
          .from("meditations")
          .select("audio_path, status, settings")
          .eq("id", meditationId)
          .single();
        if (error || !current) throw new Error("The meditation could not be found.");
        if (current.status === "processing_audio") {
          throw new Error(
            "Audio is being made from the current script right now. Tell the person to wait until it finishes, then revise.",
          );
        }

        // Once audio exists, the script describes that audio. A revision goes
        // to draft_script until a new render promotes it.
        savedAs = current.audio_path ? "draft_script" : "script";
        const update =
          savedAs === "draft_script"
            ? { draft_script: script }
            : {
                script,
                settings: {
                  ...((current.settings as MeditationSettings | null) ?? {}),
                  duration: durationMinutes,
                },
              };
        const { error: writeError } = await ctx.supabase
          .from("meditations")
          .update({ ...update, updated_at: new Date().toISOString() })
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
