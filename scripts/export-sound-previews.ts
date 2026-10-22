/**
 * Write browser-playable copies of every sound effect to public/sounds/, for
 * the chat's sound preview card. The files are committed: making them needs
 * ffmpeg and the production bucket, and the Vercel build has neither.
 *
 * Reads scripts/sound-effects.ts and changes nothing in it, so the sandbox
 * snapshot is untouched. Run it again whenever that file changes:
 *
 *   FFMPEG=/path/to/ffmpeg npx tsx scripts/export-sound-previews.ts
 *
 * With --ambient it only writes the ambient bed previews to
 * public/sounds/ambient/, and needs no bucket: every bed in
 * scripts/ambient-beds.ts, synthesized ones rendered and recorded ones read
 * from scripts/ambient/, turned down to AMBIENT_PREVIEW_LUFS, the level a bed
 * is heard at in a meditation.
 *
 * - Synthesized sounds are rendered locally from the same ffmpegArgs recipe
 *   the snapshot build runs. FFMPEG defaults to `ffmpeg` on PATH; the
 *   audio-pipeline skill says how to get one.
 * - Recorded sounds are downloaded read-only from the production
 *   `sound-effects` bucket and checksum-verified, exactly as the snapshot
 *   build does. Needs SOUND_EFFECTS_SUPABASE_URL and
 *   SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { RECORDED_SOUNDS, SYNTHESIZED_SOUNDS, ffmpegArgs } from "./sound-effects";
import {
  PREVIEW_GAIN_DB,
  RECORDED_BEDS,
  RECORDED_BED_DIR,
  SYNTHESIZED_BEDS,
  bedArgs,
  previewFile,
  recordingPreviewArgs,
} from "./ambient-beds";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(resolve(ROOT, ".env.local"));

const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const outDir = join(ROOT, "public", "sounds");
mkdirSync(outDir, { recursive: true });

function renderAmbientBeds() {
  const ambientDir = join(outDir, "ambient");
  mkdirSync(ambientDir, { recursive: true });
  for (const bed of SYNTHESIZED_BEDS) {
    const out = join(ambientDir, previewFile(bed.id));
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...bedArgs(bed, out, PREVIEW_GAIN_DB)]);
    console.log(`rendered ambient/${previewFile(bed.id)}`);
  }
  for (const bed of RECORDED_BEDS) {
    const source = join(ROOT, RECORDED_BED_DIR, previewFile(bed.id));
    const out = join(ambientDir, previewFile(bed.id));
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...recordingPreviewArgs(source, out)]);
    console.log(`wrote ambient/${previewFile(bed.id)}`);
  }
}

async function main() {
  if (process.argv.includes("--ambient")) {
    renderAmbientBeds();
    return;
  }

  const url = process.env.SOUND_EFFECTS_SUPABASE_URL;
  const key = process.env.SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SOUND_EFFECTS_SUPABASE_URL and SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY must be set (production project)",
    );
  }
  const storage = createClient(url, key).storage.from("sound-effects");

  for (const sound of RECORDED_SOUNDS) {
    const { data, error } = await storage.download(sound.storagePath);
    if (error || !data) {
      throw new Error(`Download failed for ${sound.storagePath}: ${error?.message}`);
    }
    const content = Buffer.from(await data.arrayBuffer());
    const sha256 = createHash("sha256").update(content).digest("hex");
    if (sha256 !== sound.sha256) {
      throw new Error(`Checksum mismatch for ${sound.file}: got ${sha256}`);
    }
    writeFileSync(join(outDir, sound.file), content);
    console.log(`downloaded ${sound.file}`);
  }

  for (const sound of SYNTHESIZED_SOUNDS) {
    const out = join(outDir, sound.file);
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...ffmpegArgs(sound, out)]);
    console.log(`rendered ${sound.file}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
