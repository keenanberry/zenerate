/**
 * Waveform peaks for audio rendered before the sandbox read them (ship task 60).
 *
 * The meditation page streams only when a render's generation_meta has
 * `peaks` and `duration`; without them the player downloads the whole file
 * on page load to draw the waveform. This reads the peaks from each stored
 * file with the same reader the sandbox uses (src/lib/audio/peaks.ts) and
 * writes them in: every meditation's current audio and every kept earlier
 * version (meditation_versions). Drafts have no audio of their own: a draft
 * render's file becomes the current version when it is promoted.
 *
 * DOWNLOADING IS EGRESS. Each file is downloaded once, and that counts toward
 * Supabase's monthly egress (5 GB on Free). So by default it only counts: it
 * lists the files, prints their number and total size, and stops. Pass --yes
 * to download them and write the peaks. Run it against production right
 * after an egress reset, when the operator decides to.
 *
 * Usage:
 *   npx tsx scripts/backfill-peaks.ts          # count only, downloads nothing
 *   npx tsx scripts/backfill-peaks.ts --yes    # download, read peaks, write them
 *
 * It targets NEXT_PUBLIC_SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY. They come
 * from .env.local, which points at local Supabase; variables set on the
 * command line win, which is how to point one run at production. The target
 * is printed first. Needs ffmpeg on PATH, or FFMPEG=/path/to/ffmpeg.
 *
 * Safe to run twice: a file that already has peaks is not listed. A row whose
 * audio changed while it ran (a new render) is skipped, never overwritten.
 */

import { resolve, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(resolve(ROOT, ".env.local"));
} catch {
  // No .env.local: the variables must come from the command line.
}

import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PEAKS_DECODE_ARGS, PeakReader, type Peaks } from "../src/lib/audio/peaks";

const BUCKET = "meditation-audio";
const FFMPEG = process.env.FFMPEG || "ffmpeg";

type Table = "meditations" | "meditation_versions";

interface Target {
  table: Table;
  id: string;
  /** For the listing: the meditation's title, and which version. */
  label: string;
  audioPath: string;
  /** Bytes in storage; null when the object is missing. */
  size: number | null;
}

function mb(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** PostgREST's default cap on the rows one query returns. */
const MAX_ROWS = 1000;

/**
 * Rows with audio and no peaks yet. A null generation_meta counts as none.
 * Past MAX_ROWS of either kind a run covers the first ones; the next run
 * lists the rest, since a row with peaks is no longer listed.
 */
async function findTargets(supabase: SupabaseClient): Promise<Target[]> {
  const [current, versions] = await Promise.all([
    supabase
      .from("meditations")
      .select("id, title, audio_path")
      .not("audio_path", "is", null)
      .is("generation_meta->peaks", null)
      .order("created_at"),
    supabase
      .from("meditation_versions")
      .select("id, audio_path, created_at, meditation:meditations(title)")
      .not("audio_path", "is", null)
      .is("generation_meta->peaks", null)
      .order("created_at"),
  ]);
  if (current.error) throw new Error(`Reading meditations failed: ${current.error.message}`);
  if (versions.error) throw new Error(`Reading versions failed: ${versions.error.message}`);
  if (current.data.length >= MAX_ROWS || versions.data.length >= MAX_ROWS) {
    console.log(`More than ${MAX_ROWS} rows of one kind: this run covers the first; run it again for the rest.`);
  }

  const targets: Target[] = [
    ...current.data.map((m) => ({
      table: "meditations" as const,
      id: m.id as string,
      label: m.title as string,
      audioPath: m.audio_path as string,
      size: null,
    })),
    ...versions.data.map((v) => {
      const meditation = v.meditation as unknown as { title: string } | null;
      return {
        table: "meditation_versions" as const,
        id: v.id as string,
        label: `${meditation?.title ?? "?"} (version of ${String(v.created_at).slice(0, 10)})`,
        audioPath: v.audio_path as string,
        size: null,
      };
    }),
  ];

  // Sizes from the bucket listing, one call per folder: listing reads no audio.
  const folders = new Map<string, Map<string, number>>();
  for (const target of targets) {
    const folder = posix.dirname(target.audioPath);
    const key = folder === "." ? "" : folder;
    if (!folders.has(key)) {
      const { data, error } = await supabase.storage.from(BUCKET).list(key, { limit: 1000 });
      if (error) throw new Error(`Listing ${key || "the bucket root"} failed: ${error.message}`);
      folders.set(key, new Map((data ?? []).map((f) => [f.name, Number(f.metadata?.size ?? 0)])));
    }
    target.size = folders.get(key)!.get(posix.basename(target.audioPath)) ?? null;
  }
  return targets;
}

/**
 * Decode an MP3 file with ffmpeg and read its peaks. From a file, as the
 * sandbox does, not stdin: on a pipe ffmpeg cannot apply the encoder-delay
 * trim, and the length comes out 25 ms long.
 */
function readPeaks(path: string): Promise<Peaks | null> {
  return new Promise((resolvePeaks, reject) => {
    const reader = new PeakReader();
    const ff = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", path, "-vn", ...PEAKS_DECODE_ARGS, "pipe:1"]);
    let stderr = "";
    ff.stdout.on("data", (chunk: Buffer) => reader.push(chunk));
    ff.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
    ff.on("error", reject);
    ff.on("close", (code) =>
      code === 0 ? resolvePeaks(reader.finish()) : reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`)),
    );
  });
}

/**
 * Merge the peaks into the row's generation_meta, only if it still points at
 * the file they were read from. Returns false when it no longer does.
 */
async function writePeaks(supabase: SupabaseClient, target: Target, peaks: Peaks): Promise<boolean> {
  const { data: row, error: readError } = await supabase
    .from(target.table)
    .select("generation_meta")
    .eq("id", target.id)
    .eq("audio_path", target.audioPath)
    .maybeSingle();
  if (readError) throw new Error(`Reading ${target.table} ${target.id} failed: ${readError.message}`);
  if (!row) return false;

  const meta = (row.generation_meta as Record<string, unknown> | null) ?? {};
  const { data: updated, error } = await supabase
    .from(target.table)
    .update({ generation_meta: { ...meta, peaks: peaks.peaks, duration: peaks.duration } })
    .eq("id", target.id)
    .eq("audio_path", target.audioPath)
    .select("id");
  if (error) throw new Error(`Writing ${target.table} ${target.id} failed: ${error.message}`);
  return (updated ?? []).length > 0;
}

async function main() {
  const confirmed = process.argv.includes("--yes");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

  console.log(`Target: ${url}`);
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const targets = await findTargets(supabase);

  for (const t of targets) {
    const kind = t.table === "meditations" ? "current" : "version";
    console.log(`  ${kind.padEnd(7)}  ${(t.size === null ? "missing" : mb(t.size)).padStart(8)}  ${t.label}`);
  }
  const present = targets.filter((t) => t.size !== null);
  const bytes = present.reduce((sum, t) => sum + (t.size ?? 0), 0);
  const missing = targets.length - present.length;
  console.log("");
  console.log(
    `${present.length} file${present.length === 1 ? "" : "s"} without peaks, ${bytes.toLocaleString("en-US")} bytes (${mb(bytes)}) to download.` +
      (missing ? ` ${missing} row${missing === 1 ? " points" : "s point"} at a missing file and will be skipped.` : ""),
  );

  if (present.length === 0) return;
  if (!confirmed) {
    console.log("Nothing downloaded. Downloading counts toward this project's egress; run again with --yes to backfill.");
    return;
  }

  const probe = spawnSync(FFMPEG, ["-version"]);
  if (probe.error || probe.status !== 0) {
    throw new Error(`ffmpeg not found (${FFMPEG}). Install it, or pass FFMPEG=/path/to/ffmpeg.`);
  }

  let written = 0;
  let skipped = 0;
  let failed = 0;
  let downloaded = 0;
  const scratch = await mkdtemp(resolve(tmpdir(), "backfill-peaks-"));
  const file = resolve(scratch, "audio.mp3");
  for (const [i, target] of present.entries()) {
    const prefix = `[${i + 1}/${present.length}] ${target.label}`;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(target.audioPath);
      if (error || !data) throw new Error(`download failed: ${error?.message ?? "no data"}`);
      const mp3 = Buffer.from(await data.arrayBuffer());
      downloaded += mp3.length;
      await writeFile(file, mp3);

      const peaks = await readPeaks(file);
      if (!peaks) throw new Error("no audio decoded");
      if (await writePeaks(supabase, target, peaks)) {
        written++;
        console.log(`${prefix}: ${peaks.peaks.length} peaks, ${peaks.duration.toFixed(1)}s`);
      } else {
        skipped++;
        console.log(`${prefix}: skipped, its audio changed while this ran`);
      }
    } catch (err) {
      failed++;
      console.error(`${prefix}: ${err instanceof Error ? err.message : err}`);
    }
  }
  await rm(scratch, { recursive: true, force: true });

  console.log("");
  console.log(`Wrote peaks for ${written}, skipped ${skipped}, failed ${failed}. Downloaded ${downloaded.toLocaleString("en-US")} bytes (${mb(downloaded)}).`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
