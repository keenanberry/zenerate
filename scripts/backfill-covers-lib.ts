/**
 * The pure parts of scripts/backfill-covers.ts: its arguments, where its
 * credentials came from, its pacing, the target check, and the contact
 * sheet. Kept apart so they are tested without a database, a model or the
 * Gateway.
 */

import { isAbsolute, relative, resolve } from "node:path";
import { parseEnv } from "node:util";

/** Where generated covers wait for review. `.superpowers/` is gitignored. */
export const DEFAULT_OUT = ".superpowers/cover-backfill";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Options = {
  /** Every completed meditation without a cover, private ones included. */
  all: boolean;
  /** Only these meditations (public or not). */
  ids: string[] | null;
  /** The review folder. */
  out: string;
  /** Upload the reviewed files instead of generating. */
  commit: boolean;
  /** With --ids: give these a new cover even if they have one. */
  replace: boolean;
  /** For --commit to a remote project: its host, typed back. */
  confirmTarget: string | null;
  /** Generate at most this many in one run (a trial run). */
  limit: number | null;
  /** A file of credentials outside the repository, counted as set explicitly. */
  envFile: string | null;
};

export const USAGE = `Usage: npx tsx scripts/backfill-covers.ts [--all | --ids a,b] [--replace] [--limit n] [--out dir] [--env-file path]
       npx tsx scripts/backfill-covers.ts --commit [--ids a,b] [--replace] [--out dir] [--env-file path] [--confirm-target <host>]`;

/** Parses the command line. Throws a message for the operator on anything it cannot act on. */
export function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    all: false,
    ids: null,
    out: DEFAULT_OUT,
    commit: false,
    replace: false,
    confirmTarget: null,
    limit: null,
    envFile: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].startsWith("--") ? splitOnce(argv[i]) : [argv[i], undefined];
    const value = () => {
      const next = inline ?? argv[++i];
      if (next === undefined || next === "" || next.startsWith("--")) throw new Error(`${flag} needs a value.`);
      return next;
    };
    switch (flag) {
      case "--all":
        options.all = true;
        break;
      case "--commit":
        options.commit = true;
        break;
      case "--replace":
        options.replace = true;
        break;
      case "--ids": {
        const ids = [...new Set(value().split(",").map((id) => id.trim()).filter(Boolean))];
        const bad = ids.find((id) => !UUID.test(id));
        if (bad !== undefined) throw new Error(`"${bad}" is not a meditation id.`);
        options.ids = ids;
        break;
      }
      case "--out":
        options.out = value();
        break;
      case "--confirm-target":
        options.confirmTarget = value();
        break;
      case "--env-file":
        options.envFile = value();
        break;
      case "--limit": {
        const raw = value();
        const n = Number(raw);
        if (!/^\d+$/.test(raw) || n < 1) throw new Error(`--limit takes a whole number above 0, not "${raw}".`);
        options.limit = n;
        break;
      }
      default:
        throw new Error(`Unknown option "${argv[i]}".`);
    }
  }
  if (options.all && options.ids) throw new Error("Pass either --all or --ids, not both.");
  if (options.replace && !options.ids) throw new Error("Pass --replace only with --ids, so a replacement is always named.");
  if (options.commit && (options.all || options.limit !== null)) {
    throw new Error("Pass --all and --limit only when generating; --commit uploads what is in the review folder.");
  }
  return options;
}

function splitOnce(arg: string): [string, string | undefined] {
  const eq = arg.indexOf("=");
  return eq === -1 ? [arg, undefined] : [arg.slice(0, eq), arg.slice(eq + 1)];
}

/**
 * The Gateway's free tier allows 5 image requests a minute per team, shared
 * with the live studio's makeCover. Sent in a burst of five and then a pause,
 * some were refused (its limiter refills over the minute rather than counting
 * a sliding window), so requests go out evenly, four a minute: the fifth is
 * left for anyone making a meditation while the backfill runs.
 */
export const GATEWAY_INTERVAL_MS = 15_000;

/**
 * How long to wait before the next image request, given when earlier ones
 * started (ms timestamps): until the latest is `intervalMs` old.
 */
export function waitBeforeNext(
  starts: readonly number[],
  now: number,
  intervalMs: number = GATEWAY_INTERVAL_MS,
): number {
  if (starts.length === 0) return 0;
  return Math.max(0, Math.max(...starts) + intervalMs - now);
}

/** Where a variable's value came from. Only `.env.local` is implicit. */
export type EnvSource = "environment" | "--env-file" | ".env.local";

/**
 * Fills `env` from dotenv-format layers, in order, setting only keys that are
 * unset (or empty), and returns where each set key's value came from. What
 * was already in `env` counts as "environment". Done per key, rather than by
 * comparing snapshots, so nothing loaded earlier can pass for explicit.
 */
export function fillEnv(
  env: Record<string, string | undefined>,
  layers: readonly { source: Exclude<EnvSource, "environment">; text: string }[],
): Map<string, EnvSource> {
  const sources = new Map<string, EnvSource>();
  for (const [key, value] of Object.entries(env)) if (value) sources.set(key, "environment");
  for (const { source, text } of layers) {
    for (const [key, value] of Object.entries(parseEnv(text))) {
      if (env[key] || value === undefined) continue;
      env[key] = value;
      sources.set(key, source);
    }
  }
  return sources;
}

/**
 * Why `--env-file` cannot be read, or null. It must be outside the
 * repository: production credentials never sit in the working tree, and
 * pointing it at .env.local would make local values pass for explicit ones.
 */
export function envFileProblem(path: string, root: string): string | null {
  const inside = relative(resolve(root), resolve(path));
  if (inside === "" || (!inside.startsWith("..") && !isAbsolute(inside))) {
    return `--env-file must be a file outside the repository (${root}), not ${path}.`;
  }
  return null;
}

/** Whether a Supabase URL is the local stack on this machine. */
export function isLocalSupabase(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ["127.0.0.1", "localhost", "[::1]", "::1", "0.0.0.0"].includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Why the script must not run against this target, or null when it may.
 * Local Supabase is always fine. A remote project (production) needs its URL
 * and service-role key set explicitly (in the environment or an --env-file),
 * never read from .env.local, and a commit to it needs the host typed back
 * with --confirm-target.
 */
export function targetProblem(
  target: { url: string | undefined; key: string | undefined; urlExplicit: boolean; keyExplicit: boolean },
  options: Pick<Options, "commit" | "confirmTarget">,
): string | null {
  if (!target.url) return "No NEXT_PUBLIC_SUPABASE_URL: set it (and SUPABASE_SERVICE_ROLE_KEY) to the project to read.";
  if (!target.key) return "No SUPABASE_SERVICE_ROLE_KEY for the project.";
  if (isLocalSupabase(target.url)) return null;
  if (!target.urlExplicit || !target.keyExplicit) {
    return (
      `${target.url} is not local Supabase, and its URL or key came from .env.local. ` +
      "Production credentials must come from the environment or --env-file for this run " +
      "only, both NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  const host = new URL(target.url).hostname;
  if (options.commit && options.confirmTarget !== host) {
    return `This commits covers to ${target.url}. To go ahead, pass --confirm-target ${host}.`;
  }
  return null;
}

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** The review file's extension for the provider's format. */
export function imageExtension(mediaType: string): string {
  const ext = EXTENSIONS[mediaType];
  if (!ext) throw new Error(`The provider returned ${mediaType}; expected image/png, image/jpeg or image/webp.`);
  return ext;
}

/** The media type of a review file, from its extension. */
export function mediaTypeOf(file: string): string | null {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  return Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] ?? null;
}

/**
 * FLUX sometimes draws the cover as a rounded app icon on white, which shows
 * as white slivers in a cover's rounded corners. From this many near-white
 * corners the review sheet flags the cover; a bright sky can light one or two.
 */
export const FRAMED_CORNERS = 3;

/** How many of a decoded picture's four corners are near-white. */
export function whiteCorners(image: { data: Uint8Array; width: number; height: number; channels: number }): number {
  const { data, width, height, channels } = image;
  // One pixel in from the edge, past any resampling fringe.
  const inset = Math.min(1, width - 1, height - 1);
  const points = [
    [inset, inset],
    [width - 1 - inset, inset],
    [inset, height - 1 - inset],
    [width - 1 - inset, height - 1 - inset],
  ];
  return points.filter(([x, y]) => {
    const i = (y * width + x) * channels;
    return data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
  }).length;
}

export type ManifestEntry = {
  title: string;
  subject: string;
  /** The file in the review folder, `<id>.<ext>`. */
  file: string;
  mediaType: string;
  isPublic: boolean;
  generatedAt: string;
  /** How many of the picture's corners are near-white (whiteCorners). */
  whiteCorners?: number;
  /** Set once --commit stored it: the cover_path it got. */
  committedPath?: string;
};

/** `manifest.json` in the review folder: what was generated, against which project. */
export type Manifest = {
  /** The Supabase URL the meditations were read from; a commit must target the same. */
  target: string;
  entries: Record<string, ManifestEntry>;
};

function html(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The review page: every generated cover with its title and subject. A
 * cover whose file is no longer in the folder was rejected in review.
 * Operator-only; it opens from disk and loads nothing remote.
 */
export function contactSheet(manifest: Manifest, files: ReadonlySet<string>): string {
  const entries = Object.entries(manifest.entries).sort(([, a], [, b]) => a.generatedAt.localeCompare(b.generatedAt));
  const cards = entries
    .map(([id, entry]) => {
      const present = files.has(entry.file);
      const status = entry.committedPath ? "Committed" : present ? "To commit" : "Rejected";
      const framed =
        present && !entry.committedPath && (entry.whiteCorners ?? 0) >= FRAMED_CORNERS
          ? `<span class="warn">White corners: likely drawn as a framed icon. Reject it?</span>`
          : "";
      const picture = present
        ? `<img src="${html(entry.file)}" alt="" width="256" height="256">`
        : `<div class="gone">Rejected: file removed</div>`;
      return `<figure>
  ${picture}
  <figcaption>
    <strong>${html(entry.title)}</strong>
    <span class="meta">${status}${entry.isPublic ? "" : " · Private"}</span>
    ${framed}
    <span>${html(entry.subject)}</span>
    <code>${html(id)}</code>
  </figcaption>
</figure>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cover backfill review</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 24px 16px; background: #15121c; color: #e9e4f2; font: 14px/1.5 system-ui, sans-serif; }
  header { max-width: 72rem; margin: 0 auto 24px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 4px 0; color: #b9b1c8; }
  main { max-width: 72rem; margin: 0 auto; display: grid; gap: 24px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  figure { margin: 0; }
  img, .gone { width: 100%; height: auto; aspect-ratio: 1; border-radius: 12px; display: block; background: #241f2e; }
  .gone { display: grid; place-items: center; color: #8d85a0; }
  figcaption { display: grid; gap: 4px; margin-top: 8px; }
  .meta { color: #a898d8; font-size: 12px; }
  .warn { color: #f0c674; font-size: 12px; }
  code { color: #8d85a0; font-size: 11px; overflow-wrap: anywhere; }
</style>
</head>
<body>
<header>
  <h1>Cover backfill review</h1>
  <p>Read from <code>${html(manifest.target)}</code>. ${entries.length} generated.</p>
  <p>Delete the image file of any cover you reject, then run the script again without <code>--commit</code> to make a new one for it. When every cover here is one you want, run it with <code>--commit</code>.</p>
</header>
<main>
${cards}
</main>
</body>
</html>
`;
}
