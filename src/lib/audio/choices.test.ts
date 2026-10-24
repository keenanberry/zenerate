import { describe, expect, it } from "vitest";
import { choiceNote, resolveChoice } from "./choices";

describe("resolveChoice", () => {
  it("falls back to the default with no history", () => {
    expect(resolveChoice({ fallback: "none" })).toEqual({ value: "none", origin: "default" });
  });

  it("preselects the last-used choice", () => {
    expect(resolveChoice({ lastUsed: "rain", fallback: "none" })).toEqual({
      value: "rain",
      origin: "last",
    });
  });

  it("prefers this meditation's own saved choice to another meditation's", () => {
    expect(resolveChoice({ saved: "ocean", lastUsed: "rain", fallback: "none" })).toEqual({
      value: "ocean",
      origin: "last",
    });
  });

  it("lets the agent's suggestion win over last time", () => {
    expect(
      resolveChoice({ suggested: "forest", saved: "ocean", lastUsed: "rain", fallback: "none" }),
    ).toEqual({ value: "forest", origin: "suggested" });
  });

  it("lets the person's pick win over everything", () => {
    expect(
      resolveChoice({ picked: "none", suggested: "forest", lastUsed: "rain", fallback: "none" }),
    ).toEqual({ value: "none", origin: "picked" });
  });
});

describe("choiceNote", () => {
  it("names where a preselection came from", () => {
    expect(choiceNote("suggested")).toBe("Suggested for this one");
    expect(choiceNote("last")).toBe("Same as last time");
    expect(choiceNote("picked")).toBeNull();
    expect(choiceNote("default")).toBeNull();
  });
});
