/**
 * Creates a Vercel Sandbox snapshot pre-loaded with:
 *   - FFmpeg (via ffmpeg-static npm package)
 *   - Node.js dependencies (fluent-ffmpeg, @elevenlabs/elevenlabs-js)
 *   - The compiled generate-audio.js script
 *   - Sound effect stubs (silence files — replace with real audio later)
 *
 * Prerequisites:
 *   1. Run `vercel link` to connect to a Vercel project
 *   2. Run `vercel env pull` to get a VERCEL_OIDC_TOKEN in .env.local
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
import { build } from "esbuild";
import { Writable } from "node:stream";

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

async function main() {
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

  log("Creating sounds directory with stubs...");
  await sandbox.mkDir("sounds");
  await sandbox.mkDir("temp");

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
