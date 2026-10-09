import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pngSize } from "../../scripts/icons/raster";
import { GROUND_DARK } from "@/lib/brand/ground";
import manifest from "./manifest";

const m = manifest();

describe("web app manifest", () => {
  it("installs as a standalone app that opens to the library", () => {
    expect(m.name).toBe("Zenerate");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/dashboard");
  });

  it("has a short name that fits under a home-screen icon", () => {
    // iOS and Android begin truncating labels at around 12 characters.
    expect(m.short_name!.length).toBeLessThanOrEqual(12);
  });

  it("uses the dark ground for the theme and splash", () => {
    expect(m.theme_color).toBe(GROUND_DARK);
    expect(m.background_color).toBe(GROUND_DARK);
  });

  it("declares a maskable icon", () => {
    expect(m.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it.each(m.icons ?? [])("$src exists at its declared size", (icon) => {
    const file = readFileSync(resolve(__dirname, "../../public", icon.src.slice(1)));
    const { width, height } = pngSize(file);
    expect(`${width}x${height}`).toBe(icon.sizes);
  });
});
