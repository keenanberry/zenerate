import { describe, it, expect } from "vitest";
import {
  checkRenderScript,
  checkRenderSettings,
  MAX_PAUSE_SECONDS,
  MAX_SILENCE_MINUTES,
  MAX_SPEECH_CHARACTERS,
} from "./render-bounds";

const HOUSE = [
  "*[SOUND: gong-gentle.mp3]*",
  "Settle into a comfortable position and let your eyes close.",
  "*[PAUSE: 5 seconds]*",
  "Breathe in slowly, and out.",
  "*[SILENCE: 10 minutes]*",
  "When you are ready, open your eyes.",
  "*[SOUND: bell-tibetan.mp3]*",
].join("\n");

describe("checkRenderScript", () => {
  it("passes a house-shaped meditation through with every segment", () => {
    const result = checkRenderScript(HOUSE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.segments).toHaveLength(7);
  });

  it("refuses a 50,000-character script", () => {
    const result = checkRenderScript("Breathe. ".repeat(5556));
    expect(result).toMatchObject({ ok: false });
  });

  it("refuses more speech than one render may narrate", () => {
    const line = "Let the breath come and go on its own. ";
    const script = line.repeat(Math.ceil((MAX_SPEECH_CHARACTERS + 1) / line.length));
    expect(script.length).toBeLessThan(30000);
    expect(checkRenderScript(script)).toMatchObject({ ok: false, error: expect.stringMatching(/narration/) });
  });

  it("takes narration just under the cap", () => {
    const script = "x".repeat(MAX_SPEECH_CHARACTERS);
    expect(checkRenderScript(script).ok).toBe(true);
  });

  it("refuses a 999-minute silence", () => {
    expect(checkRenderScript(`Breathe.\n*[SILENCE: 999 minutes]*`)).toMatchObject({ ok: false });
  });

  it("refuses a silence or a pause past its cap, and takes one at it", () => {
    expect(checkRenderScript(`Hi.\n*[SILENCE: ${MAX_SILENCE_MINUTES + 1} minutes]*`).ok).toBe(false);
    expect(checkRenderScript(`Hi.\n*[SILENCE: ${MAX_SILENCE_MINUTES} minutes]*`).ok).toBe(true);
    expect(checkRenderScript(`Hi.\n*[PAUSE: ${MAX_PAUSE_SECONDS + 1} seconds]*`).ok).toBe(false);
    expect(checkRenderScript(`Hi.\n*[PAUSE: ${MAX_PAUSE_SECONDS} seconds]*`).ok).toBe(true);
  });

  it("refuses a total runtime past two hours, however it is split", () => {
    const blocks = Array.from({ length: 5 }, () => "*[SILENCE: 25 minutes]*").join("\nBreathe.\n");
    expect(checkRenderScript(`Hi.\n${blocks}`)).toMatchObject({ ok: false, error: expect.stringMatching(/long/) });
  });

  it.each(["../config.json", "../../etc/passwd", "sub/gong-gentle.mp3", "..\\config.json"])(
    "refuses a sound marker that names a path, %s",
    (file) => {
      expect(checkRenderScript(`Hi.\n*[SOUND: ${file}]*`)).toMatchObject({ ok: false });
    },
  );

  it("drops a sound that is not in the catalog", () => {
    const result = checkRenderScript("Hi.\n*[SOUND: kazoo.mp3]*\n*[SOUND: gong-deep.mp3]*");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.segments).toEqual([
        { type: "speech", content: "Hi." },
        { type: "sound", file: "gong-deep.mp3" },
      ]);
    }
  });

  it("refuses a script with nothing to narrate", () => {
    expect(checkRenderScript("*[PAUSE: 3 seconds]*\n")).toMatchObject({ ok: false });
    expect(checkRenderScript("")).toMatchObject({ ok: false });
  });
});

describe("checkRenderSettings", () => {
  it("passes saved settings through", () => {
    expect(checkRenderSettings({ duration: 10, voice: "v", music: "rain", volume: 0.5 })).toEqual({
      ok: true,
      settings: { voice: "v", music: "rain", volume: 0.5 },
    });
  });

  it("treats missing settings as none", () => {
    expect(checkRenderSettings(null)).toEqual({ ok: true, settings: {} });
    expect(checkRenderSettings({ voice: null, music: null, volume: null })).toEqual({ ok: true, settings: {} });
  });

  it.each([
    ["a filter-graph volume", { volume: "1,anull" }],
    ["an infinite volume", { volume: Infinity }],
    ["a NaN volume", { volume: NaN }],
    ["a bed that is not a string", { music: { path: "../../config" } }],
    ["a voice that is not a string", { voice: 7 }],
    ["settings that are not an object", "loud"],
  ])("refuses %s", (_, settings) => {
    expect(checkRenderSettings(settings).ok).toBe(false);
  });

  it("reads a bed it does not know, like the retired brown-noise, as none", () => {
    expect(checkRenderSettings({ music: "brown-noise" })).toEqual({ ok: true, settings: {} });
    expect(checkRenderSettings({ music: "../../config" })).toEqual({ ok: true, settings: {} });
  });

  it("clamps a volume into [0, 1]", () => {
    expect(checkRenderSettings({ volume: 7 })).toEqual({ ok: true, settings: { volume: 1 } });
    expect(checkRenderSettings({ volume: -2 })).toEqual({ ok: true, settings: { volume: 0 } });
  });
});
