/**
 * Render the synthesized sound effects locally, to listen before baking them
 * into the sandbox snapshot.
 *
 *   FFMPEG=/path/to/ffmpeg npx tsx scripts/preview-sound-effects.ts [outDir]
 *
 * FFMPEG defaults to `ffmpeg` on PATH. outDir defaults to ./sound-preview.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { SYNTHESIZED_SOUNDS, ffmpegArgs } from "./sound-effects";

const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const outDir = resolve(process.argv[2] ?? "sound-preview");
mkdirSync(outDir, { recursive: true });

for (const effect of SYNTHESIZED_SOUNDS) {
  const out = join(outDir, effect.file);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...ffmpegArgs(effect, out)]);
  console.log(`rendered ${out}`);
}
