/**
 * Manual integration test for the generation quota.
 *
 * Prereqs:
 *   - supabase running locally (`supabase start`)
 *   - .env.local populated
 *
 * Usage:
 *   npx tsx scripts/test-generation-quota.ts
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const envPath = resolve(dirname(__filename), "..", ".env.local");
process.loadEnvFile(envPath);

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function ensureUser(): Promise<string> {
  const email = `quota-test-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "password123",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  return data.user.id;
}

async function ensureMeditation(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("meditations")
    .insert({
      user_id: userId,
      title: "quota test",
      prompt: "x",
      status: "script_ready",
      script: "[narration] hello",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`insert meditation: ${error?.message}`);
  return data.id;
}

async function reserve(userId: string, meditationId: string, retryOf: string | null = null) {
  return supabase.rpc("reserve_audio_generation", {
    p_user_id: userId,
    p_meditation_id: meditationId,
    p_per_user_cap: 3,
    p_global_cap: 500,
    p_retry_of: retryOf,
  });
}

async function main() {
  console.log("== sequential per-user cap ==");
  const userId = await ensureUser();
  const m1 = await ensureMeditation(userId);
  for (let i = 1; i <= 3; i++) {
    const { data, error } = await reserve(userId, m1);
    if (error) throw new Error(`reserve ${i}: ${error.message}`);
    console.log(`  reserve ${i} → eventId ${data}`);
  }
  const fourth = await reserve(userId, m1);
  if (fourth.error?.message !== "quota_exceeded") {
    throw new Error(`expected quota_exceeded, got ${fourth.error?.message ?? "ok"}`);
  }
  console.log("  4th reserve → quota_exceeded ✓");

  console.log("== free retry on failure ==");
  const userId2 = await ensureUser();
  const m2 = await ensureMeditation(userId2);
  const first = await reserve(userId2, m2);
  if (first.error) throw new Error(first.error.message);
  await supabase
    .from("audio_generation_events")
    .update({ status: "failed", completed_at: new Date().toISOString() })
    .eq("id", first.data as string);
  const retry = await reserve(userId2, m2, first.data as string);
  if (retry.error) throw new Error(`retry reserve: ${retry.error.message}`);
  console.log(`  retry reserve → ${retry.data} ✓`);
  // double-retry should fail
  const retry2 = await reserve(userId2, m2, first.data as string);
  if (retry2.error?.message !== "invalid_retry") {
    throw new Error(`expected invalid_retry, got ${retry2.error?.message ?? "ok"}`);
  }
  console.log("  second retry → invalid_retry ✓");

  console.log("== parallel race ==");
  const userId3 = await ensureUser();
  const m3 = await ensureMeditation(userId3);
  const results = await Promise.all([reserve(userId3, m3), reserve(userId3, m3), reserve(userId3, m3), reserve(userId3, m3)]);
  const successes = results.filter((r) => !r.error).length;
  const exceeded = results.filter((r) => r.error?.message === "quota_exceeded").length;
  if (successes !== 3 || exceeded !== 1) {
    throw new Error(`expected 3 success + 1 exceeded, got ${successes}/${exceeded}`);
  }
  console.log(`  3 successes + 1 quota_exceeded ✓`);

  console.log("\nALL CHECKS PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
