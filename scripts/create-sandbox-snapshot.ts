/**
 * Creates a Vercel Sandbox snapshot pre-loaded with:
 *   - FFmpeg (via ffmpeg-static npm package)
 *   - Node.js dependencies (fluent-ffmpeg, @elevenlabs/elevenlabs-js)
 *   - The compiled generate-audio.js script
 *   - The sound effects in scripts/sound-effects.ts, in /sounds: synthesized
 *     ones rendered here by the sandbox's FFmpeg, recorded ones downloaded
 *     from the production `sound-effects` bucket and checksum-verified
 *
 * Prerequisites:
 *   1. Run `vercel link` to connect to a Vercel project
 *   2. A VERCEL_OIDC_TOKEN. Get one with
 *      `vercel env pull --environment=development <some other file>` and copy
 *      the token across -- pulling into .env.local overwrites it.
 *   3. SOUND_EFFECTS_SUPABASE_URL and SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY
 *      for the PRODUCTION project, set for this run only. Deliberately not the
 *      app's own variable names: .env.local points those at local Supabase,
 *      which has no sound files.
 *
 * Usage:
 *   npx tsx scripts/create-sandbox-snapshot.ts
 *
 * After running, copy the printed snapshot ID into your .env.local as
 * AUDIO_SANDBOX_SNAPSHOT_ID.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
process.loadEnvFile(resolve(ROOT, ".env.local"));

import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@supabase/supabase-js";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { Writable } from "node:stream";
import { RECORDED_SOUNDS, SYNTHESIZED_SOUNDS, ffmpegArgs } from "./sound-effects";

function log(msg: string) {
  console.log(`[snapshot] ${msg}`);
}

function logStream(): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      process.stdout.write(`  | ${chunk}`);
      callback();
    },
  });
}

async function compileGenerateAudio(): Promise<Buffer> {
  const result = await build({
    entryPoints: [resolve(ROOT, "src/lib/audio/generate-audio.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    external: ["@elevenlabs/elevenlabs-js", "fluent-ffmpeg"],
    banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
    write: false,
  });

  return Buffer.from(result.outputFiles[0].contents);
}

/** Download and verify every recorded sound before any sandbox time is spent. */
async function fetchRecordedSounds(): Promise<{ path: string; content: Buffer }[]> {
  const url = process.env.SOUND_EFFECTS_SUPABASE_URL;
  const key = process.env.SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SOUND_EFFECTS_SUPABASE_URL and SOUND_EFFECTS_SUPABASE_SERVICE_ROLE_KEY must be set (production project)",
    );
  }
  const storage = createClient(url, key).storage.from("sound-effects");

  const files = [];
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
    log(`  ${sound.file} verified (${(content.length / 1024).toFixed(0)} KB)`);
    files.push({ path: `sounds/${sound.file}`, content });
  }
  return files;
}

async function main() {
  log("Fetching recorded sound effects...");
  const recordedSounds = await fetchRecordedSounds();

  log("Compiling generate-audio.ts → JS...");
  const scriptBuffer = await compileGenerateAudio();
  log(`Compiled (${(scriptBuffer.length / 1024).toFixed(1)} KB)`);

  log("Creating sandbox (node22)...");
  const sandbox = await Sandbox.create({ runtime: "node22" });
  log(`Sandbox created: ${sandbox.sandboxId}`);

  const out = logStream();

  log("Writing package.json...");
  const packageJson = JSON.stringify({
    name: "meditation-audio-sandbox",
    type: "module",
    dependencies: {
      "fluent-ffmpeg": "^2.1.2",
      "@elevenlabs/elevenlabs-js": "latest",
      "ffmpeg-static": "latest",
    },
  });
  await sandbox.writeFiles([
    { path: "package.json", content: Buffer.from(packageJson) },
  ]);

  log("Running npm install...");
  const npmResult = await sandbox.runCommand({
    cmd: "npm",
    args: ["install"],
    stdout: out,
    stderr: out,
  });
  if (npmResult.exitCode !== 0) {
    throw new Error(`npm install failed with exit code ${npmResult.exitCode}`);
  }

  log("Symlinking ffmpeg binary to PATH...");
  const symlinkResult = await sandbox.runCommand({
    cmd: "sudo",
    args: ["ln", "-sf", "/vercel/sandbox/node_modules/ffmpeg-static/ffmpeg", "/usr/local/bin/ffmpeg"],
  });
  if (symlinkResult.exitCode !== 0) {
    throw new Error(`FFmpeg symlink failed with exit code ${symlinkResult.exitCode}`);
  }

  log("Verifying FFmpeg...");
  const ffmpegVersion = await sandbox.runCommand("ffmpeg", ["-version"]);
  log(`  ${(await ffmpegVersion.stdout()).split("\n")[0]}`);

  log("Uploading generate-audio.js...");
  await sandbox.writeFiles([
    { path: "generate-audio.js", content: scriptBuffer },
  ]);

  log("Installing sound effects...");
  await sandbox.mkDir("sounds");
  await sandbox.mkDir("temp");
  await sandbox.writeFiles(recordedSounds);
  for (const sound of SYNTHESIZED_SOUNDS) {
    const render = await sandbox.runCommand({
      cmd: "ffmpeg",
      args: ["-hide_banner", "-loglevel", "error", ...ffmpegArgs(sound, `sounds/${sound.file}`)],
      stdout: out,
      stderr: out,
    });
    if (render.exitCode !== 0) {
      throw new Error(`Rendering ${sound.file} failed with exit code ${render.exitCode}`);
    }
    log(`  ${sound.file} rendered`);
  }
  const listing = await sandbox.runCommand("ls", ["-l", "sounds"]);
  log(`  /sounds:\n${await listing.stdout()}`);

  log("Taking snapshot (permanent, expiration: 0)...");
  const snapshot = await sandbox.snapshot({ expiration: 0 });

  log("========================================");
  log(`Snapshot ID: ${snapshot.snapshotId}`);
  log(`Size: ${(snapshot.sizeBytes / 1024 / 1024).toFixed(1)} MB`);
  log(`Status: ${snapshot.status}`);
  log("========================================");
  log("");
  log("Add this to your .env.local:");
  log(`  AUDIO_SANDBOX_SNAPSHOT_ID=${snapshot.snapshotId}`);
}

main().catch((err) => {
  console.error("Snapshot creation failed:", err);
  process.exit(1);
});
