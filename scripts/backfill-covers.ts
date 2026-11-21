/**
 * Generated covers for meditations made before the studio made them
 * (cover art PR 3; docs/superpowers/specs/2026-11-21-generated-cover-art-design.md).
 *
 * Two steps, and nothing reaches the database until the operator has looked:
 *
 * 1. Generate (the default). For each completed meditation without a cover,
 *    asks Claude (the studio model) for a subject from its title,
 *    description and tags, under the studio's own rules, and makes the image
 *    with COVER_MODEL through AI Gateway. Each image is written to the review
 *    folder (default .superpowers/cover-backfill/) as `<id>.<ext>`, beside a
 *    manifest.json and an index.html contact sheet. It reads the database and
 *    writes nothing to it or to Storage.
 * 2. Commit (--commit). Uploads the files still in the folder with storeCover
 *    (full WebP, 512px middle size, 256px thumbnail) and sets cover_path. It
 *    never generates.
 *
 * Review by opening index.html and deleting the image file of any cover you
 * reject (the sheet flags one drawn as a framed icon with white corners); running step 1 again makes a new one for it, and skips every id
 * whose file is still there. A meditation that has a cover by the time of the
 * commit (the studio made one) is skipped, unless --replace.
 *
 * Usage:
 *   npx tsx scripts/backfill-covers.ts                 # public meditations without a cover
 *   npx tsx scripts/backfill-covers.ts --all           # private ones too
 *   npx tsx scripts/backfill-covers.ts --ids a,b       # just these (public or not)
 *   npx tsx scripts/backfill-covers.ts --ids a --replace   # these, even with a cover
 *   npx tsx scripts/backfill-covers.ts --limit 3       # a trial run
 *   npx tsx scripts/backfill-covers.ts --commit        # upload what is in the folder
 *
 * Target: NEXT_PUBLIC_SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY. .env.local
 * fills them in for local Supabase only: for any other project (production),
 * both must be set on the command line, a commit must also name the host with
 * --confirm-target, and a commit refuses a folder generated from a different
 * project. The target is printed before anything else happens.
 *
 * Also needs ANTHROPIC_API_KEY (the subject) and Gateway auth for the image:
 * AI_GATEWAY_API_KEY, or VERCEL_OIDC_TOKEN from
 *   vercel -Q "$HOME/.vercel-personal" env pull .superpowers/gw.env --environment development --yes
 * then `set -a; source .superpowers/gw.env; set +a` (never pull into .env.local).
 * Paced to the Gateway free tier's 5 image requests a minute, one every 13s;
 * a cover that still fails (a refusal, a rate limit) is retried by the next run.
 */

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Which credentials the operator set for this run, before .env.local fills in the rest.
const URL_FROM_COMMAND_LINE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const KEY_FROM_COMMAND_LINE = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
try {
  // Never overrides a variable already set.
  process.loadEnvFile(resolve(ROOT, ".env.local"));
} catch {
  // No .env.local: the variables must come from the command line.
}

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { studioModel } from "../src/lib/chat/model";
import { generateCover } from "../src/lib/cover/generate";
import { COVER_MODEL } from "../src/lib/cover/model";
import { storeCover } from "../src/lib/cover/store";
import { cleanSubject, COVER_SUBJECT_SYSTEM, subjectRequest } from "../src/lib/cover/subject";
import {
  contactSheet,
  FRAMED_CORNERS,
  imageExtension,
  mediaTypeOf,
  parseArgs,
  targetProblem,
  USAGE,
  waitBeforeNext,
  whiteCorners,
  type Manifest,
  type Options,
} from "./backfill-covers-lib";

type Row = {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  is_public: boolean;
  status: string;
  cover_path: string | null;
};

/** PostgREST's default cap on the rows one query returns; a run covers the first. */
const MAX_ROWS = 1000;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Raw pixels of a generated image, for the white-corner check. */
async function decode(bytes: Uint8Array) {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

async function readManifest(out: string): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(join(out, "manifest.json"), "utf8")) as Manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function saveManifest(out: string, manifest: Manifest) {
  await writeFile(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const files = new Set(await readdir(out));
  await writeFile(join(out, "index.html"), contactSheet(manifest, files));
}

/** Completed meditations to make covers for, oldest first. */
async function findMeditations(supabase: SupabaseClient, options: Options): Promise<Row[]> {
  let query = supabase
    .from("meditations")
    .select("id, title, description, tags, is_public, status, cover_path")
    .eq("status", "completed")
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (options.ids) query = query.in("id", options.ids);
  else if (!options.all) query = query.eq("is_public", true);
  if (!options.replace) query = query.is("cover_path", null);
  const { data, error } = await query;
  if (error) fail(`Reading meditations failed: ${error.message}`);
  const rows = (data ?? []) as Row[];
  if (options.ids) {
    const found = new Set(rows.map((row) => row.id));
    for (const id of options.ids) {
      if (!found.has(id)) console.log(`  ${id}: not a completed meditation${options.replace ? "" : " without a cover"}; skipped`);
    }
  }
  if (rows.length === MAX_ROWS) console.log(`More than ${MAX_ROWS} meditations: this run covers the first; run it again for the rest.`);
  return rows;
}

async function generate(supabase: SupabaseClient, options: Options, target: string) {
  if (!process.env.ANTHROPIC_API_KEY) fail("ANTHROPIC_API_KEY is not set; it writes each cover's subject.");
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    fail("No Gateway auth: set AI_GATEWAY_API_KEY, or source VERCEL_OIDC_TOKEN from `vercel env pull` (see the top of this file).");
  }

  const out = resolve(ROOT, options.out);
  await mkdir(out, { recursive: true });
  const manifest = (await readManifest(out)) ?? { target, entries: {} };
  if (manifest.target !== target) {
    fail(`${out} holds covers generated from ${manifest.target}. Use another --out for ${target}.`);
  }

  const files = new Set(await readdir(out));
  const rows = await findMeditations(supabase, options);
  // An id whose file is still in the folder was generated and kept; a removed file was rejected.
  const todo = rows.filter((row) => {
    const entry = manifest.entries[row.id];
    return !(entry && files.has(entry.file));
  });
  const run = options.limit ? todo.slice(0, options.limit) : todo;
  console.log(
    `${rows.length} meditation(s) selected, ${rows.length - todo.length} already in the review folder, ${run.length} to generate.`,
  );

  const model = studioModel();
  const anthropic = createAnthropic();
  // A run started right after another shares the Gateway's limit with it. Each entry's
  // generatedAt is no earlier than its request's start, so pacing from it is safe.
  const starts = Object.values(manifest.entries)
    .map((entry) => Date.parse(entry.generatedAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  let made = 0;
  let failed = 0;
  for (const [i, row] of run.entries()) {
    const label = `[${i + 1}/${run.length}] ${row.title} (${row.id})`;
    try {
      const { text } = await generateText({
        model: anthropic(model),
        system: COVER_SUBJECT_SYSTEM,
        prompt: subjectRequest(row),
        maxOutputTokens: 2000,
        providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: "low" } },
      });
      const subject = cleanSubject(text);

      const wait = waitBeforeNext(starts, Date.now());
      if (wait > 0) {
        console.log(`  waiting ${Math.ceil(wait / 1000)}s for the Gateway's rate limit`);
        await sleep(wait);
      }
      starts.push(Date.now());
      const image = await generateCover(subject);

      const file = `${row.id}.${imageExtension(image.mediaType)}`;
      await writeFile(join(out, file), image.bytes);
      const corners = whiteCorners(await decode(image.bytes));
      manifest.entries[row.id] = {
        title: row.title,
        subject,
        file,
        mediaType: image.mediaType,
        isPublic: row.is_public,
        generatedAt: new Date().toISOString(),
        whiteCorners: corners,
      };
      await saveManifest(out, manifest);
      made++;
      console.log(`${label}\n  ${subject}${corners >= FRAMED_CORNERS ? "\n  white corners: check it on the sheet" : ""}`);
    } catch (error) {
      // One failure (a refusal, a rate limit) leaves that meditation for the next run.
      failed++;
      console.error(`${label}\n  failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await saveManifest(out, manifest);
  console.log(`\n${made} generated${failed ? `, ${failed} failed (run again to retry them)` : ""}. Review: ${join(out, "index.html")}`);
  console.log("Delete the image of any cover you reject and run again; then run with --commit.");
}

async function commit(supabase: SupabaseClient, options: Options, target: string) {
  const out = resolve(ROOT, options.out);
  const manifest = await readManifest(out);
  if (!manifest) fail(`No manifest.json in ${out}: generate first (run without --commit).`);
  if (manifest.target !== target) {
    fail(`${out} was generated from ${manifest.target}, not ${target}. Its ids belong to that project.`);
  }

  const files = new Set(await readdir(out));
  const ids = Object.keys(manifest.entries).filter((id) => !options.ids || options.ids.includes(id));
  let stored = 0;
  for (const id of ids) {
    const entry = manifest.entries[id];
    const label = `${entry.title} (${id})`;
    if (!files.has(entry.file)) {
      console.log(`${label}: rejected in review (file removed); skipped`);
      continue;
    }
    // Read again now: the meditation may have been deleted, unpublished or given a cover since.
    const { data: row, error } = await supabase
      .from("meditations")
      .select("id, status, cover_path")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error(`${label}: reading it failed: ${error.message}`);
      continue;
    }
    if (!row || row.status !== "completed") {
      console.log(`${label}: no longer a completed meditation; skipped`);
      continue;
    }
    if (row.cover_path && !options.replace) {
      if (row.cover_path !== entry.committedPath) console.log(`${label}: has a cover already; skipped (pass --ids ${id} --replace to replace it)`);
      continue;
    }
    try {
      const mediaType = mediaTypeOf(entry.file) ?? entry.mediaType;
      const bytes = new Uint8Array(await readFile(join(out, entry.file)));
      const { path } = await storeCover(id, { bytes, mediaType });
      entry.committedPath = path;
      await saveManifest(out, manifest);
      stored++;
      console.log(`${label}: stored at ${path}`);
    } catch (error) {
      console.error(`${label}: failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  await saveManifest(out, manifest);
  console.log(`\n${stored} cover(s) committed to ${target}.`);
}

async function main() {
  let options: Options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(`${(error as Error).message}\n${USAGE}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  console.log(
    `Target: ${url ?? "(none)"} (URL from ${URL_FROM_COMMAND_LINE ? "the command line" : ".env.local"}, ` +
      `key from ${KEY_FROM_COMMAND_LINE ? "the command line" : ".env.local"})`,
  );
  console.log(options.commit ? "Mode: commit reviewed covers" : `Mode: generate into ${options.out} (writes nothing to the target)`);
  const problem = targetProblem(
    { url, urlFromCommandLine: URL_FROM_COMMAND_LINE, keyFromCommandLine: KEY_FROM_COMMAND_LINE },
    options,
  );
  if (problem) fail(problem);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) fail("SUPABASE_SERVICE_ROLE_KEY is not set.");
  if (!options.commit) console.log(`Model: ${COVER_MODEL}; subjects by ${studioModel()}`);

  const supabase = createClient(url!, key, { auth: { autoRefreshToken: false, persistSession: false } });
  if (options.commit) await commit(supabase, options, url!);
  else await generate(supabase, options, url!);
}

main().catch((error) => fail(error instanceof Error ? error.stack ?? error.message : String(error)));
