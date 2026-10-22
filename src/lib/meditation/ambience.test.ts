import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { AMBIENCES, AMBIENCE_IDS, isAmbienceId, savedAmbience, type AmbienceId } from "./ambience";
import {
  AMBIENT_PREVIEW_LUFS,
  BED_LUFS,
  PREVIEW_GAIN_DB,
  RECORDED_BEDS,
  RECORDED_BED_DIR,
  SYNTHESIZED_BEDS,
  previewFile,
  snapshotFile,
} from "../../../scripts/ambient-beds";

const PUBLIC = join(process.cwd(), "public");
const BEDS = AMBIENCE_IDS.filter((id) => id !== "none");

describe("ambience catalog", () => {
  it("keys every entry by its own id", () => {
    expect(Object.keys(AMBIENCES).sort()).toEqual([...AMBIENCE_IDS].sort());
    for (const id of AMBIENCE_IDS) expect(AMBIENCES[id].id).toBe(id);
  });

  it("offers None, which mixes nothing", () => {
    expect(AMBIENCES.none).toMatchObject({ snapshotPath: null, previewUrl: null });
  });

  // The card plays these. An entry without one is a dead play button; rerun
  // scripts/export-sound-previews.ts --ambient when this fails.
  it("has a preview file for every bed", () => {
    for (const id of BEDS) {
      const url = AMBIENCES[id].previewUrl;
      expect(url, id).toBeTruthy();
      expect(existsSync(join(PUBLIC, url!)), url!).toBe(true);
    }
  });

  it("has no preview file the catalog has dropped", () => {
    expect(readdirSync(join(PUBLIC, "sounds", "ambient")).sort()).toEqual(
      BEDS.map(previewFile).sort(),
    );
  });

  it("has a build recipe or recording for every bed, at the path the workflow mixes", () => {
    const built = [...SYNTHESIZED_BEDS, ...RECORDED_BEDS];
    expect(built.map((b) => b.id).sort()).toEqual([...BEDS].sort());
    for (const b of built) {
      expect(AMBIENCES[b.id as AmbienceId].snapshotPath).toBe(`sounds/ambient/${snapshotFile(b)}`);
    }
  });

  it("commits exactly the recordings the snapshot build verifies", () => {
    for (const bed of RECORDED_BEDS) {
      const file = join(process.cwd(), RECORDED_BED_DIR, previewFile(bed.id));
      const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
      expect(sha256, bed.id).toBe(bed.sha256);
      expect(bed.license).toBe("CC0-1.0");
      expect(bed.source).toMatch(/^https:\/\/freesound\.org\//);
    }
  });

  // The previews are turned down to the level a bed is heard at under
  // narration, not left at the files' level, which played 9 dB louder.
  it("previews each bed at its in-mix level", () => {
    expect(AMBIENT_PREVIEW_LUFS).toBeLessThan(BED_LUFS);
    expect(PREVIEW_GAIN_DB).toBe(AMBIENT_PREVIEW_LUFS - BED_LUFS);
  });

  it("keeps every bed under the narration", () => {
    for (const id of BEDS) {
      expect(AMBIENCES[id].volume, id).toBeGreaterThan(0);
      expect(AMBIENCES[id].volume, id).toBeLessThanOrEqual(1);
    }
  });
});

describe("isAmbienceId / savedAmbience", () => {
  it("accepts catalog ids only", () => {
    expect(isAmbienceId("rain")).toBe(true);
    expect(isAmbienceId("none")).toBe(true);
    expect(isAmbienceId("sounds/ambient/rain.mp3")).toBe(false);
    expect(isAmbienceId(undefined)).toBe(false);
  });

  it("reads an unknown or missing saved value as no choice", () => {
    expect(savedAmbience("ocean")).toBe("ocean");
    expect(savedAmbience("whale-song")).toBeNull();
    expect(savedAmbience(undefined)).toBeNull();
  });
});
