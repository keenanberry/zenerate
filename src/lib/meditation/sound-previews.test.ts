import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { SOUND_EFFECTS } from "./sounds";
import { SOUND_LABELS, SOUND_NAMES, soundPreview } from "./sound-previews";
import { RECORDED_SOUNDS } from "../../../scripts/sound-effects";

const PUBLIC_SOUNDS = join(process.cwd(), "public", "sounds");

// The preview card plays these files. A catalog entry without one is a dead
// play button; rerun scripts/export-sound-previews.ts when this fails.
describe("sound previews", () => {
  it("has a file in public/sounds/ for every sound effect", () => {
    for (const name of Object.keys(SOUND_EFFECTS)) {
      expect(existsSync(join(PUBLIC_SOUNDS, name)), name).toBe(true);
    }
  });

  it("has no file the catalog has dropped", () => {
    expect(readdirSync(PUBLIC_SOUNDS).sort()).toEqual(Object.keys(SOUND_EFFECTS).sort());
  });

  it("serves the same recordings the snapshot verifies", () => {
    for (const sound of RECORDED_SOUNDS) {
      const sha256 = createHash("sha256").update(readFileSync(join(PUBLIC_SOUNDS, sound.file))).digest("hex");
      expect(sha256, sound.file).toBe(sound.sha256);
    }
  });

  it("labels every sound and points at its file", () => {
    for (const name of SOUND_NAMES) {
      expect(SOUND_LABELS[name], name).toBeTruthy();
      expect(soundPreview(name)).toEqual({
        name,
        label: SOUND_LABELS[name],
        url: `/sounds/${name}`,
        seconds: SOUND_EFFECTS[name],
      });
    }
  });
});
