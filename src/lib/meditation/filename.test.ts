import { describe, it, expect } from "vitest";
import { toDownloadFilename } from "./filename";

describe("toDownloadFilename", () => {
  it("slugifies an ordinary title", () => {
    expect(toDownloadFilename("Morning Calm — Gratitude")).toBe(
      "morning-calm-gratitude.mp3",
    );
  });

  it("strips accents rather than the letters carrying them", () => {
    expect(toDownloadFilename("Café Tranquility")).toBe(
      "cafe-tranquility.mp3",
    );
  });

  it("collapses runs of separators and trims the ends", () => {
    expect(toDownloadFilename("  ...Deep   Rest!!!  ")).toBe("deep-rest.mp3");
  });

  describe("header safety", () => {
    /**
     * The result is interpolated into a Content-Disposition header. Titles are
     * user-supplied and this app is public, so a quote or newline surviving
     * into the header would break it -- or forge another one.
     */
    it("removes double quotes", () => {
      expect(toDownloadFilename('He said "relax" to me')).toBe(
        "he-said-relax-to-me.mp3",
      );
    });

    it("removes CR and LF so a header cannot be forged", () => {
      const out = toDownloadFilename('x"\r\nX-Injected: yes');
      expect(out).not.toContain("\r");
      expect(out).not.toContain("\n");
      expect(out).toBe("x-x-injected-yes.mp3");
    });

    it("removes path separators and traversal sequences", () => {
      expect(toDownloadFilename("../../etc/passwd")).toBe("etc-passwd.mp3");
      expect(toDownloadFilename("C:\\Windows\\System32")).toBe(
        "c-windows-system32.mp3",
      );
    });

    it("removes semicolons, which delimit header parameters", () => {
      expect(toDownloadFilename("a; filename=evil")).toBe(
        "a-filename-evil.mp3",
      );
    });
  });

  describe("degenerate titles", () => {
    /**
     * These are the cases that produce an empty stem, i.e. a bare ".mp3" --
     * a hidden file on macOS and Linux, and confusing everywhere.
     */
    it("falls back when the title is empty", () => {
      expect(toDownloadFilename("")).toBe("meditation.mp3");
    });

    it("falls back when the title is only whitespace", () => {
      expect(toDownloadFilename("   \t  ")).toBe("meditation.mp3");
    });

    it("falls back when the title is only punctuation", () => {
      expect(toDownloadFilename("!!! --- ???")).toBe("meditation.mp3");
    });

    it("falls back when the title has no ASCII letters at all", () => {
      // Slugification is ASCII-only, so a fully non-Latin title reduces to
      // nothing. The fallback is what stops that becoming ".mp3".
      expect(toDownloadFilename("朝の瞑想")).toBe("meditation.mp3");
    });

    it("falls back on null and undefined", () => {
      expect(toDownloadFilename(null)).toBe("meditation.mp3");
      expect(toDownloadFilename(undefined)).toBe("meditation.mp3");
    });
  });

  describe("length", () => {
    it("caps the stem and leaves no trailing separator", () => {
      const out = toDownloadFilename("a ".repeat(100).trim());
      expect(out.endsWith(".mp3")).toBe(true);
      const stem = out.slice(0, -".mp3".length);
      expect(stem.length).toBeLessThanOrEqual(60);
      // Truncation can land mid-separator; trimming happens after the slice.
      expect(stem.endsWith("-")).toBe(false);
    });

    it("does not truncate a title that already fits", () => {
      expect(toDownloadFilename("Body Scan")).toBe("body-scan.mp3");
    });
  });
});
