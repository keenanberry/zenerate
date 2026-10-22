import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { AMBIENCES, AMBIENCE_IDS, isAmbienceId, savedAmbience } from "./ambience";
import { RECORDED_BEDS, SYNTHESIZED_BEDS, bedFile } from "../../../scripts/ambient-beds";

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
      BEDS.map(bedFile).sort(),
    );
  });

  it("has a build recipe or recording for every bed, at the path the workflow mixes", () => {
    const built = [...SYNTHESIZED_BEDS, ...RECORDED_BEDS].map((b) => b.id).sort();
    expect(built).toEqual([...BEDS].sort());
    for (const id of BEDS) {
      expect(AMBIENCES[id].snapshotPath).toBe(`sounds/ambient/${bedFile(id)}`);
    }
  });

  it("commits exactly the recordings the snapshot build verifies", () => {
    for (const bed of RECORDED_BEDS) {
      const file = join(PUBLIC, "sounds", "ambient", bedFile(bed.id));
      const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
      expect(sha256, bed.id).toBe(bed.sha256);
      expect(bed.license).toBe("CC0-1.0");
      expect(bed.source).toMatch(/^https:\/\/freesound\.org\//);
    }
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
