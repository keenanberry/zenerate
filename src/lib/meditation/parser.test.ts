import { describe, it, expect } from "vitest";
import { parseMeditationText } from "./parser";

/**
 * Characterization tests for the markup parser.
 *
 * These exist because of the model swap in task 18. The parser's marker
 * regexes are anchored to the whole trimmed line, and `MEDITATION_SYSTEM_PROMPT`
 * is the only thing making a model emit that exact shape. A model change is
 * precisely the event that shifts formatting, and until now nothing here was
 * tested -- a regression would have surfaced as meditations that sound wrong,
 * not as a failing build.
 *
 * The "silently dropped" group below is the important one: malformed markers
 * do not throw and do not degrade to speech. They vanish. See the comment
 * there before relaxing anything.
 */
describe("parseMeditationText", () => {
  describe("markers the prompt asks for", () => {
    it("parses a pause into seconds", () => {
      expect(parseMeditationText("*[PAUSE: 8 seconds]*")).toEqual([
        { type: "pause", duration: 8 },
      ]);
    });

    it("parses a silence and converts minutes to seconds", () => {
      // The unit change is easy to miss and would make a 5-minute silence
      // five seconds long.
      expect(parseMeditationText("*[SILENCE: 5 minutes]*")).toEqual([
        { type: "silence", duration: 300 },
      ]);
    });

    it("parses a sound file", () => {
      expect(parseMeditationText("*[SOUND: bell-tibetan.mp3]*")).toEqual([
        { type: "sound", file: "bell-tibetan.mp3" },
      ]);
    });

    it("accepts singular units", () => {
      expect(parseMeditationText("*[PAUSE: 1 second]*")).toEqual([
        { type: "pause", duration: 1 },
      ]);
      expect(parseMeditationText("*[SILENCE: 1 minute]*")).toEqual([
        { type: "silence", duration: 60 },
      ]);
    });

    it("is case-insensitive", () => {
      expect(parseMeditationText("*[pause: 3 seconds]*")).toEqual([
        { type: "pause", duration: 3 },
      ]);
    });

    it("tolerates extra whitespace inside and around the marker", () => {
      expect(parseMeditationText("   *[PAUSE:   12   seconds]*   ")).toEqual([
        { type: "pause", duration: 12 },
      ]);
    });
  });

  describe("speech", () => {
    it("joins consecutive lines into one segment with single spaces", () => {
      const out = parseMeditationText("Welcome.\nSettle in.\nBreathe.");
      expect(out).toEqual([
        { type: "speech", content: "Welcome. Settle in. Breathe." },
      ]);
    });

    it("splits speech around a marker", () => {
      const out = parseMeditationText("Breathe in.\n*[PAUSE: 5 seconds]*\nAnd out.");
      expect(out).toEqual([
        { type: "speech", content: "Breathe in." },
        { type: "pause", duration: 5 },
        { type: "speech", content: "And out." },
      ]);
    });

    it("ignores blank lines", () => {
      const out = parseMeditationText("Welcome.\n\n\nSettle in.");
      expect(out).toEqual([{ type: "speech", content: "Welcome. Settle in." }]);
    });

    it("flushes trailing speech at the end of input", () => {
      const out = parseMeditationText("*[PAUSE: 3 seconds]*\nCome back slowly.");
      expect(out).toEqual([
        { type: "pause", duration: 3 },
        { type: "speech", content: "Come back slowly." },
      ]);
    });
  });

  describe("silently dropped input -- the model-change failure mode", () => {
    /**
     * A line starting with "*[" that does not match a marker regex is neither
     * parsed as a marker nor kept as speech (parser.ts line 57). It disappears
     * with no error anywhere.
     *
     * These tests assert the CURRENT behavior so a future change is a
     * deliberate decision rather than an accident. They are not an endorsement
     * of it -- if a model starts producing any of these shapes, meditations
     * will quietly lose content, and the fix belongs in the prompt or the
     * parser, not here.
     */
    it("drops a marker whose unit the regex does not recognise", () => {
      // "3s" instead of "3 seconds"
      expect(parseMeditationText("*[PAUSE: 3s]*")).toEqual([]);
    });

    it("drops a marker with a non-integer duration", () => {
      expect(parseMeditationText("*[PAUSE: 2.5 seconds]*")).toEqual([]);
    });

    it("drops an entire line when a marker is inline with speech", () => {
      // The worst case: real script content vanishes along with the marker.
      expect(
        parseMeditationText("*[PAUSE: 3 seconds]* Welcome back."),
      ).toEqual([]);
    });

    it("drops an unknown marker type", () => {
      expect(parseMeditationText("*[MUSIC: rain.mp3]*")).toEqual([]);
    });

    it("keeps surrounding speech when a malformed marker is dropped", () => {
      const out = parseMeditationText("Breathe in.\n*[PAUSE: 3s]*\nAnd out.");
      // Note the two speech lines MERGE, because nothing flushed between them.
      // A malformed pause does not just lose its own timing -- it changes how
      // the speech either side is segmented.
      expect(out).toEqual([
        { type: "speech", content: "Breathe in. And out." },
      ]);
    });
  });

  describe("a full script in the documented format", () => {
    it("parses the shape MEDITATION_SYSTEM_PROMPT demonstrates", () => {
      const script = [
        "*[SOUND: bell-tibetan.mp3]*",
        "",
        "Welcome to this moment of stillness.",
        "",
        "*[PAUSE: 3 seconds]*",
        "",
        "Gently close your eyes.",
        "",
        "*[SILENCE: 5 minutes]*",
        "",
        "*[SOUND: gong-gentle.mp3]*",
        "",
        "Slowly begin to return.",
      ].join("\n");

      expect(parseMeditationText(script)).toEqual([
        { type: "sound", file: "bell-tibetan.mp3" },
        { type: "speech", content: "Welcome to this moment of stillness." },
        { type: "pause", duration: 3 },
        { type: "speech", content: "Gently close your eyes." },
        { type: "silence", duration: 300 },
        { type: "sound", file: "gong-gentle.mp3" },
        { type: "speech", content: "Slowly begin to return." },
      ]);
    });

    it("returns nothing for empty input", () => {
      expect(parseMeditationText("")).toEqual([]);
    });
  });
});
