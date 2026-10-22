import { describe, it, expect } from "vitest";
import { countOf, freeTierSummary } from "./copy";

describe("countOf", () => {
  it("uses the singular for one and the plural otherwise", () => {
    expect(countOf(1, "script")).toBe("1 script");
    expect(countOf(3, "script")).toBe("3 scripts");
    expect(countOf(2, "body", "bodies")).toBe("2 bodies");
  });
});

describe("freeTierSummary", () => {
  it("states the audio cap as given", () => {
    expect(freeTierSummary({ audio: 3 })).toBe(
      "Each month an account can narrate 3 meditations. Writing and revising scripts doesn't count toward it.",
    );
  });

  it("stays grammatical at a cap of one", () => {
    expect(freeTierSummary({ audio: 1 })).toMatch(/^Each month an account can narrate 1 meditation\. /);
  });
});
