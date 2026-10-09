import { describe, it, expect } from "vitest";
import {
  DEFAULT_VOICE_ID,
  VOICE_COLLECTION_ID,
  parseVoiceTitle,
  resolveVoiceId,
  toVoiceCatalog,
  type ElevenLabsVoice,
} from "./catalog";

describe("parseVoiceTitle", () => {
  it("splits a library title on its hyphen", () => {
    expect(parseVoiceTitle("Vincent - Deep, Relaxing, and Round")).toEqual({
      name: "Vincent",
      description: "Deep, Relaxing, and Round",
    });
  });

  it("splits on an en dash too", () => {
    expect(parseVoiceTitle("Serena – Gentle Coach and Wellness Guide")).toEqual({
      name: "Serena",
      description: "Gentle Coach and Wellness Guide",
    });
  });

  it("keeps a hyphenated name intact", () => {
    // Only " - " with spaces separates; "Mary-Kate" is one name.
    expect(parseVoiceTitle("Mary-Kate - Soft and Warm").name).toBe("Mary-Kate");
  });

  it("uses the whole title as the name when there is no description", () => {
    expect(parseVoiceTitle("Brittney")).toEqual({ name: "Brittney", description: "" });
  });
});

function voice(id: string, title: string, collections: string[] | null): ElevenLabsVoice {
  return {
    voice_id: id,
    name: title,
    labels: { gender: "female" },
    preview_url: `https://example.com/${id}.mp3`,
    collection_ids: collections,
  };
}

describe("toVoiceCatalog", () => {
  const raw = [
    voice("v-zed", "Zed - Last alphabetically", [VOICE_COLLECTION_ID]),
    voice(DEFAULT_VOICE_ID, "Brittney - Relaxing, Calm and Meditative", [VOICE_COLLECTION_ID]),
    voice("v-out", "Michael - Not in the collection", null),
    voice("v-amy", "Amy - First alphabetically", [VOICE_COLLECTION_ID, "other"]),
  ];

  it("keeps only voices in the collection", () => {
    const ids = toVoiceCatalog(raw).map((v) => v.voiceId);
    expect(ids).not.toContain("v-out");
    expect(ids).toHaveLength(3);
  });

  it("lists the default voice first, then the rest by name", () => {
    expect(toVoiceCatalog(raw).map((v) => v.name)).toEqual(["Brittney", "Amy", "Zed"]);
  });

  it("falls back to 'unknown' when ElevenLabs has no gender label", () => {
    const [v] = toVoiceCatalog([{ ...raw[1], labels: null }]);
    expect(v.gender).toBe("unknown");
  });
});

describe("resolveVoiceId", () => {
  const allowed = new Set([DEFAULT_VOICE_ID, "v-amy"]);

  it("accepts a voice in the collection", () => {
    expect(resolveVoiceId("v-amy", allowed)).toEqual({ ok: true, voiceId: "v-amy" });
  });

  it("returns no override when none is requested", () => {
    // A free retry sends no voice; the workflow then reuses the voice saved
    // on the meditation by the first attempt, rather than a default.
    expect(resolveVoiceId(undefined, allowed)).toEqual({ ok: true, voiceId: null });
    expect(resolveVoiceId(null, allowed)).toEqual({ ok: true, voiceId: null });
  });

  it("rejects a voice outside the collection", () => {
    // Any ElevenLabs library voice id would otherwise be accepted.
    expect(resolveVoiceId("some-library-voice", allowed)).toEqual({ ok: false });
  });

  it("rejects a non-string voice id", () => {
    expect(resolveVoiceId(42, allowed)).toEqual({ ok: false });
  });
});
