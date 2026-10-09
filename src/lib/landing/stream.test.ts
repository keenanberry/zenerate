import { describe, it, expect } from "vitest";
import { countWords, revealWords } from "./stream";

describe("countWords", () => {
  it("counts runs of non-whitespace across lines", () => {
    expect(countWords("Breathe in.\n\n*[PAUSE: 5 seconds]*\nAnd out.")).toBe(7);
  });

  it("is zero for empty or blank text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  \n\t ")).toBe(0);
  });
});

describe("revealWords", () => {
  const text = "Settle in.\n\n*[PAUSE: 5 seconds]*\n\nBreathe.";

  it("is empty for zero or fewer words", () => {
    expect(revealWords(text, 0)).toBe("");
    expect(revealWords(text, -2)).toBe("");
  });

  it("stops at the end of the nth word, keeping line breaks", () => {
    expect(revealWords(text, 1)).toBe("Settle");
    expect(revealWords(text, 3)).toBe("Settle in.\n\n*[PAUSE:");
  });

  it("returns the whole text once n reaches the word count", () => {
    expect(revealWords(text, countWords(text))).toBe(text.trimEnd());
    expect(revealWords(text, 99)).toBe(text);
  });
});
