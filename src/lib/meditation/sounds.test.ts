import { describe, it, expect } from "vitest";
import { SOUND_EFFECTS } from "./sounds";
import { MEDITATION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { RECORDED_SOUNDS, SYNTHESIZED_SOUNDS } from "../../../scripts/sound-effects";

// The model can only name sounds the prompt offers, and the snapshot can only
// contain sounds the build script produces. Any drift between the three
// silently turns a sound marker into a second of silence.
describe("sound effect catalog", () => {
  const catalog = Object.keys(SOUND_EFFECTS).sort();

  it("offers the model exactly the catalog", () => {
    const line = MEDITATION_SYSTEM_PROMPT.match(/Available sounds: (.+)/)?.[1] ?? "";
    const offered = [...line.matchAll(/[\w-]+\.mp3/g)].map((m) => m[0]).sort();
    expect(offered).toEqual(catalog);
  });

  it("is exactly what the snapshot build produces", () => {
    const built = [...SYNTHESIZED_SOUNDS, ...RECORDED_SOUNDS].map((s) => s.file).sort();
    expect(built).toEqual(catalog);
  });

  it("records each sound's real length", () => {
    for (const s of [...SYNTHESIZED_SOUNDS, ...RECORDED_SOUNDS]) {
      expect(SOUND_EFFECTS[s.file as keyof typeof SOUND_EFFECTS], s.file).toBe(s.duration);
    }
  });

  it("only uses recordings it has the right to redistribute", () => {
    for (const s of RECORDED_SOUNDS) {
      expect(s.license, s.file).toBe("CC0-1.0");
    }
  });
});
