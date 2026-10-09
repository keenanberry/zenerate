import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { oklchToHex, parseColorTokens } from "../../../scripts/icons/color";
import { GROUND_DARK, GROUND_LIGHT } from "./ground";

const tokens = parseColorTokens(
  readFileSync(resolve(__dirname, "../../../DESIGN.md"), "utf8"),
);

describe("page grounds", () => {
  it("dark is DESIGN.md's Midnight", () => {
    expect(GROUND_DARK).toBe(oklchToHex(tokens["midnight"]));
  });

  it("light is DESIGN.md's Paper", () => {
    expect(GROUND_LIGHT).toBe(oklchToHex(tokens["paper"]));
  });
});
