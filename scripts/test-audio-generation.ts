/**
 * Integration test for the audio generation pipeline.
 *
 * Spins up a Vercel Sandbox from the snapshot, runs generate-audio.js with a
 * minimal meditation script (~50 characters of speech), and validates the
 * output MP3 and result.json.
 *
 * Prerequisites:
 *   - AUDIO_SANDBOX_SNAPSHOT_ID set in .env.local
 *   - ELEVENLABS_API_KEY set in .env.local
 *   - Vercel auth configured (VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID)
 *
 * Usage:
 *   npx tsx scripts/test-audio-generation.ts
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const envPath = resolve(dirname(__filename), "..", ".env.local");
process.loadEnvFile(envPath);

import { Sandbox } from "@vercel/sandbox";
import { mkdir, writeFile } from "node:fs/promises";
import { Writable } from "node:stream";

const ROOT = resolve(dirname(__filename), "..");
const OUTPUT_DIR = resolve(ROOT, "test-output");

function log(msg: string) {
  console.log(`[test] ${msg}`);
}

function logStream(): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      process.stdout.write(`  | ${chunk}`);
      callback();
    },
  });
}

async function main() {
  const snapshotId = process.env.AUDIO_SANDBOX_SNAPSHOT_ID;
  if (!snapshotId) {
    throw new Error("AUDIO_SANDBOX_SNAPSHOT_ID not set in environment");
  }

  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) {
    throw new Error("ELEVENLABS_API_KEY not set in environment");
  }

  const config = {
    segments: [
      { type: "speech", content: "Welcome. Take a deep breath." },
      { type: "pause", duration: 2 },
      { type: "speech", content: "Now slowly exhale." },
      { type: "silence", duration: 5 },
      { type: "sound", file: "gong.mp3" },
      { type: "speech", content: "When you are ready, open your eyes." },
    ],
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    elevenLabsApiKey,
  };

  log("Creating sandbox from snapshot...");
  const startTime = Date.now();
  const sandbox = await Sandbox.create({
    runtime: "node22",
    source: { type: "snapshot", snapshotId },
    timeout: 5 * 60 * 1000,
  });
  const sandboxTime = Date.now() - startTime;
  log(`Sandbox ready in ${sandboxTime}ms (${sandbox.sandboxId})`);

  const out = logStream();

  try {
    log("Writing config.json...");
    await sandbox.writeFiles([
      { path: "config.json", content: Buffer.from(JSON.stringify(config, null, 2)) },
    ]);

    log("Running generate-audio.js...");
    const genStart = Date.now();
    const result = await sandbox.runCommand({
      cmd: "node",
      args: ["generate-audio.js"],
      stdout: out,
      stderr: out,
    });
    const genTime = Date.now() - genStart;

    if (result.exitCode !== 0) {
      const stderr = await result.stderr();
      throw new Error(`generate-audio.js failed (exit ${result.exitCode}):\n${stderr}`);
    }
    log(`Generation completed in ${(genTime / 1000).toFixed(1)}s`);

    // Validate output.mp3
    log("Reading output.mp3...");
    const audioBuffer = await sandbox.readFileToBuffer({ path: "output.mp3" });
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error("output.mp3 is missing or empty");
    }
    log(`output.mp3: ${(audioBuffer.length / 1024).toFixed(1)} KB`);

    // Validate result.json
    log("Reading result.json...");
    const resultBuffer = await sandbox.readFileToBuffer({ path: "result.json" });
    if (!resultBuffer) {
      throw new Error("result.json is missing");
    }
    const resultData = JSON.parse(resultBuffer.toString("utf-8"));

    const checks = [
      { name: "ttsCharacters", ok: typeof resultData.ttsCharacters === "number" && resultData.ttsCharacters > 0 },
      { name: "ttsRequests", ok: typeof resultData.ttsRequests === "number" && resultData.ttsRequests === 3 },
      { name: "processingTimeMs", ok: typeof resultData.processingTimeMs === "number" && resultData.processingTimeMs > 0 },
      { name: "generatedAt", ok: typeof resultData.generatedAt === "string" },
    ];

    log("Validating result.json...");
    let allPassed = true;
    for (const check of checks) {
      const status = check.ok ? "PASS" : "FAIL";
      log(`  ${status}: ${check.name} = ${JSON.stringify(resultData[check.name])}`);
      if (!check.ok) allPassed = false;
    }

    // Save MP3 locally for manual listening
    await mkdir(OUTPUT_DIR, { recursive: true });
    const outputPath = resolve(OUTPUT_DIR, "test-meditation.mp3");
    await writeFile(outputPath, audioBuffer);
    log(`Saved MP3 to ${outputPath}`);

    // Summary
    log("");
    log("========================================");
    log("  Test Summary");
    log("========================================");
    log(`  Status:           ${allPassed ? "ALL PASSED" : "SOME FAILED"}`);
    log(`  Sandbox startup:  ${sandboxTime}ms`);
    log(`  Generation time:  ${(genTime / 1000).toFixed(1)}s`);
    log(`  Output size:      ${(audioBuffer.length / 1024).toFixed(1)} KB`);
    log(`  TTS characters:   ${resultData.ttsCharacters}`);
    log(`  TTS requests:     ${resultData.ttsRequests}`);
    log(`  Processing time:  ${resultData.processingTimeMs}ms`);
    log("========================================");

    if (!allPassed) {
      process.exit(1);
    }
  } finally {
    log("Stopping sandbox...");
    await sandbox.stop({ blocking: true }).catch(() => {});
    log("Done.");
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
