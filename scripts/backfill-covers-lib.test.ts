import { describe, expect, it } from "vitest";
import {
  contactSheet,
  DEFAULT_OUT,
  envFileProblem,
  fillEnv,
  FRAMED_CORNERS,
  whiteCorners,
  GATEWAY_INTERVAL_MS,
  imageExtension,
  isLocalSupabase,
  parseArgs,
  targetProblem,
  waitBeforeNext,
  type Manifest,
} from "./backfill-covers-lib";

const A = "6f1c2a9e-3b7d-4e21-9a0c-5d8f7e6b1a24";
const B = "0b7a1f3c-2d4e-4f50-8a6b-9c0d1e2f3a4b";

describe("parseArgs", () => {
  it("defaults to generating for public meditations into the review folder", () => {
    expect(parseArgs([])).toEqual({
      all: false,
      ids: null,
      out: DEFAULT_OUT,
      commit: false,
      replace: false,
      confirmTarget: null,
      limit: null,
      envFile: null,
    });
  });

  it("reads every flag, in either --flag value or --flag=value form", () => {
    expect(
      parseArgs([
        "--ids",
        `${A},${B}`,
        "--out=tmp/covers",
        "--commit",
        "--replace",
        "--confirm-target",
        "abc.supabase.co",
        "--env-file",
        "/Users/me/prod.env",
      ]),
    ).toEqual({
      all: false,
      ids: [A, B],
      out: "tmp/covers",
      commit: true,
      replace: true,
      confirmTarget: "abc.supabase.co",
      limit: null,
      envFile: "/Users/me/prod.env",
    });
    expect(parseArgs(["--all", "--limit=3"])).toMatchObject({ all: true, limit: 3 });
  });

  it("ignores blank entries and repeats in --ids", () => {
    expect(parseArgs(["--ids", `${A},,${A}, ${B}`]).ids).toEqual([A, B]);
  });

  it("refuses what it cannot act on safely", () => {
    expect(() => parseArgs(["--ids", "not-an-id"])).toThrow(/not a meditation id/i);
    expect(() => parseArgs(["--ids"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--all", "--ids", A])).toThrow(/either --all or --ids/);
    expect(() => parseArgs(["--replace"])).toThrow(/--replace only with --ids/);
    expect(() => parseArgs(["--limit", "0"])).toThrow(/--limit/);
    expect(() => parseArgs(["--limit", "two"])).toThrow(/--limit/);
    expect(() => parseArgs(["--yes"])).toThrow(/Unknown option "--yes"/);
    expect(() => parseArgs(["extra"])).toThrow(/Unknown option "extra"/);
    // Generate-only flags would be silently ignored by a commit.
    expect(() => parseArgs(["--commit", "--all"])).toThrow(/--all and --limit only when generating/);
    expect(() => parseArgs(["--commit", "--limit", "2"])).toThrow(/--all and --limit only when generating/);
  });
});

describe("waitBeforeNext", () => {
  const MIN = 60_000;

  it("does not wait for the first request", () => {
    expect(waitBeforeNext([], 1_000)).toBe(0);
  });

  it("spaces requests evenly, four a minute, leaving the live studio the fifth", () => {
    expect(GATEWAY_INTERVAL_MS).toBe(15_000);
    expect(waitBeforeNext([10_000], 15_000)).toBe(10_000);
    expect(waitBeforeNext([10_000], 25_000)).toBe(0);
    expect(waitBeforeNext([10_000], 40_000)).toBe(0);
  });

  it("waits from the latest start, whatever order they are in", () => {
    expect(waitBeforeNext([20_000, 0, 10_000], 25_000, 12_000)).toBe(7_000);
  });

  it("never sends more than four in any minute over a long run", () => {
    const starts: number[] = [];
    let now = 0;
    for (let i = 0; i < 23; i++) {
      now += waitBeforeNext(starts, now);
      starts.push(now);
      now += 2_500; // one generation
    }
    for (const start of starts) {
      const inWindow = starts.filter((s) => s >= start && s < start + MIN);
      expect(inWindow.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("fillEnv", () => {
  it("keeps what the environment set and fills only unset keys, layer by layer, recording each key's source", () => {
    const env: Record<string, string | undefined> = { NEXT_PUBLIC_SUPABASE_URL: "https://shell.supabase.co" };
    const sources = fillEnv(env, [
      { source: "--env-file", text: "NEXT_PUBLIC_SUPABASE_URL=https://file.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=file-key\n" },
      { source: ".env.local", text: "SUPABASE_SERVICE_ROLE_KEY=local-key\nANTHROPIC_API_KEY=local-anthropic\n" },
    ]);
    expect(env).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://shell.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "file-key",
      ANTHROPIC_API_KEY: "local-anthropic",
    });
    expect(sources.get("NEXT_PUBLIC_SUPABASE_URL")).toBe("environment");
    expect(sources.get("SUPABASE_SERVICE_ROLE_KEY")).toBe("--env-file");
    expect(sources.get("ANTHROPIC_API_KEY")).toBe(".env.local");
    expect(sources.get("MISSING")).toBeUndefined();
  });

  it("treats an empty value in the environment as unset", () => {
    const env: Record<string, string | undefined> = { SUPABASE_SERVICE_ROLE_KEY: "" };
    const sources = fillEnv(env, [{ source: ".env.local", text: "SUPABASE_SERVICE_ROLE_KEY=local-key" }]);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("local-key");
    expect(sources.get("SUPABASE_SERVICE_ROLE_KEY")).toBe(".env.local");
  });
});

describe("envFileProblem", () => {
  it("takes a file outside the repository only", () => {
    expect(envFileProblem("/Users/me/secrets/prod.env", "/Users/me/zenerate")).toBeNull();
    expect(envFileProblem("/Users/me/zenerate/.env.local", "/Users/me/zenerate")).toMatch(/outside the repository/);
    expect(envFileProblem("/Users/me/zenerate/.superpowers/prod.env", "/Users/me/zenerate")).toMatch(
      /outside the repository/,
    );
    // A sibling whose name starts with the repo's is outside it.
    expect(envFileProblem("/Users/me/zenerate-secrets/prod.env", "/Users/me/zenerate")).toBeNull();
  });
});

describe("isLocalSupabase", () => {
  it("is true only for a Supabase on this machine", () => {
    expect(isLocalSupabase("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabase("http://localhost:54321/")).toBe(true);
    expect(isLocalSupabase("http://[::1]:54321")).toBe(true);
    expect(isLocalSupabase("https://abc.supabase.co")).toBe(false);
    expect(isLocalSupabase("https://localhost.example.com")).toBe(false);
    expect(isLocalSupabase("not a url")).toBe(false);
  });
});

describe("targetProblem", () => {
  const PROD = "https://abc.supabase.co";
  const explicit = { url: PROD, key: "k", urlExplicit: true, keyExplicit: true };

  it("lets any run target local Supabase, credentials from .env.local included", () => {
    const local = { url: "http://127.0.0.1:54321", key: "k", urlExplicit: false, keyExplicit: false };
    expect(targetProblem(local, { commit: false, confirmTarget: null })).toBeNull();
    expect(targetProblem(local, { commit: true, confirmTarget: null })).toBeNull();
  });

  it("needs a URL and a key at all", () => {
    expect(targetProblem({ ...explicit, url: undefined }, { commit: false, confirmTarget: null })).toMatch(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expect(targetProblem({ ...explicit, key: undefined }, { commit: false, confirmTarget: null })).toMatch(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(
      targetProblem({ ...explicit, url: "http://127.0.0.1:54321", key: "" }, { commit: false, confirmTarget: null }),
    ).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("refuses a remote project whose URL or key came from .env.local", () => {
    for (const from of [
      { urlExplicit: false, keyExplicit: true },
      { urlExplicit: true, keyExplicit: false },
    ]) {
      expect(targetProblem({ ...explicit, ...from }, { commit: false, confirmTarget: null })).toMatch(
        /environment or --env-file/,
      );
    }
  });

  it("generates from a remote project given explicit credentials", () => {
    expect(targetProblem(explicit, { commit: false, confirmTarget: null })).toBeNull();
  });

  it("commits to a remote project only when its host is typed back", () => {
    expect(targetProblem(explicit, { commit: true, confirmTarget: null })).toMatch(
      /--confirm-target abc\.supabase\.co/,
    );
    expect(targetProblem(explicit, { commit: true, confirmTarget: "xyz.supabase.co" })).toMatch(
      /--confirm-target abc\.supabase\.co/,
    );
    expect(targetProblem(explicit, { commit: true, confirmTarget: "abc.supabase.co" })).toBeNull();
  });
});

describe("imageExtension", () => {
  it("names the file by the provider's format", () => {
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/webp")).toBe("webp");
    expect(() => imageExtension("text/html")).toThrow(/image\/png, image\/jpeg or image\/webp/);
  });
});

describe("contactSheet", () => {
  const manifest: Manifest = {
    target: "https://abc.supabase.co",
    entries: {
      [A]: {
        title: "Evening <wind-down>",
        subject: 'A still lake & "mist".',
        file: `${A}.png`,
        mediaType: "image/png",
        isPublic: true,
        generatedAt: "2026-11-21T10:00:00.000Z",
        whiteCorners: 4,
      },
      [B]: {
        title: "Private one",
        subject: "A fawn in ferns.",
        file: `${B}.jpg`,
        mediaType: "image/jpeg",
        isPublic: false,
        generatedAt: "2026-11-21T10:00:15.000Z",
        committedPath: `${B}/x.webp`,
      },
    },
  };

  it("shows each cover with its title and subject, escaped", () => {
    const html = contactSheet(manifest, new Set([`${A}.png`, `${B}.jpg`]));
    expect(html).toContain(`src="${A}.png"`);
    expect(html).toContain("Evening &lt;wind-down&gt;");
    expect(html).toContain("A still lake &amp; &quot;mist&quot;.");
    expect(html).not.toContain("<wind-down>");
    expect(html).toContain("https://abc.supabase.co");
  });

  it("marks private, committed and rejected covers", () => {
    const html = contactSheet(manifest, new Set([`${B}.jpg`]));
    expect(html).toContain("Private");
    expect(html).toContain("Committed");
    // A's file was deleted in review: listed as rejected, with no image.
    expect(html).not.toContain(`src="${A}.png"`);
    expect(html).toContain("Rejected");
  });

  it("warns about a cover with white corners while it is still to commit", () => {
    expect(contactSheet(manifest, new Set([`${A}.png`]))).toContain("White corners");
    expect(contactSheet(manifest, new Set([`${B}.jpg`]))).not.toContain("White corners");
  });
});

describe("whiteCorners", () => {
  // A 10x10 RGB picture of one colour, with chosen corners painted white.
  function picture(fill: number, whiteAt: [number, number][] = []) {
    const width = 10;
    const height = 10;
    const channels = 3;
    const data = new Uint8Array(width * height * channels).fill(fill);
    for (const [x, y] of whiteAt) data.fill(255, (y * width + x) * channels, (y * width + x + 1) * channels);
    return { data, width, height, channels };
  }

  it("counts the corners that are near-white, a picture drawn as a framed icon", () => {
    expect(whiteCorners(picture(90))).toBe(0);
    expect(whiteCorners(picture(90, [[1, 1], [8, 1], [1, 8], [8, 8]]))).toBe(4);
    expect(whiteCorners(picture(90, [[1, 1], [8, 1]]))).toBe(2);
  });

  it("reads past an alpha channel", () => {
    const rgba = { data: new Uint8Array(4 * 4 * 4).fill(250), width: 4, height: 4, channels: 4 };
    expect(whiteCorners(rgba)).toBe(4);
  });

  it("flags a cover from three white corners", () => {
    expect(FRAMED_CORNERS).toBe(3);
  });
});
