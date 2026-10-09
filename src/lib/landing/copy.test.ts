import { describe, it, expect } from "vitest";
import { countOf, firstPassage, freeTierSummary } from "./copy";

describe("countOf", () => {
  it("uses the singular for one and the plural otherwise", () => {
    expect(countOf(1, "script")).toBe("1 script");
    expect(countOf(3, "script")).toBe("3 scripts");
    expect(countOf(2, "body", "bodies")).toBe("2 bodies");
  });
});

describe("freeTierSummary", () => {
  it("states both caps as given", () => {
    expect(freeTierSummary({ audio: 3, script: 30 })).toBe(
      "Each month an account can narrate 3 meditations and draft up to 30 scripts.",
    );
  });

  it("stays grammatical at a cap of one", () => {
    expect(freeTierSummary({ audio: 1, script: 1 })).toBe(
      "Each month an account can narrate 1 meditation and draft up to 1 script.",
    );
  });
});

describe("firstPassage", () => {
  it("skips leading markers and returns the first spoken passage", () => {
    const script = "*[SOUND: bell-tibetan.mp3]*\n\nArrive here.\nSlowly.\n\n*[PAUSE: 5 seconds]*\n\nLater.";
    expect(firstPassage(script)).toBe("Arrive here. Slowly.");
  });

  it("is null for a missing script or one with no speech", () => {
    expect(firstPassage(null)).toBeNull();
    expect(firstPassage("*[SILENCE: 1 minute]*")).toBeNull();
  });
});
