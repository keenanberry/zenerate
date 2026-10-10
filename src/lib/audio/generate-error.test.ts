import { describe, expect, it } from "vitest";
import { generateErrorMessage } from "./generate-error";

// What the generate panel shows for a failed POST /api/audio/generate. The
// route writes a specific sentence for every failure it understands; the
// panel must show that sentence, not a guess from the status code.
describe("generateErrorMessage", () => {
  it("shows the route's own sentence when it sent one, whatever the status", () => {
    expect(generateErrorMessage(503, { error: "Audio generation couldn't start. Nothing was used." })).toBe(
      "Audio generation couldn't start. Nothing was used.",
    );
    expect(generateErrorMessage(400, { error: "Unknown voice" })).toBe("Unknown voice");
    expect(generateErrorMessage(409, { error: "Cannot generate audio: status is failed" })).toBe(
      "Cannot generate audio: status is failed",
    );
  });

  it("names the monthly limit on 429", () => {
    expect(generateErrorMessage(429, { error: "Monthly limit reached", remaining: 0 })).toBe("Monthly limit reached");
    expect(generateErrorMessage(429, {})).toBe("Monthly limit reached");
  });

  it("falls back to a generic sentence only when the route said nothing", () => {
    expect(generateErrorMessage(503, {})).toBe("Audio generation is temporarily unavailable. Try again shortly.");
    expect(generateErrorMessage(500, {})).toBe("Failed to start audio generation");
  });
});
