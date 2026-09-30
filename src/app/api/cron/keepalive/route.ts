import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/service-role";

/**
 * Supabase Free-plan projects pause after 7 days of low activity, and a
 * paused project needs a MANUAL dashboard restore -- it does not wake on the
 * next request. That defeats the phone use case entirely: open the installed
 * app after a quiet week and it is dead until someone reaches a laptop.
 *
 * This route exists to be hit once a day by a Vercel cron so the project
 * never looks idle. See docs/runbooks/backup-restore.md for the other half
 * (the weaker backup story that comes with staying on Free).
 */

/**
 * Without this, Next can serve a cached response and the database is never
 * touched -- a keepalive that generates no activity is worse than none,
 * because it looks like it is working.
 */
export const dynamic = "force-dynamic";

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  // This leaks the secret's length and nothing else, which is standard.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Notify a dead-man's-switch that this run succeeded, if one is configured.
 *
 * Vercel's logs can show a run that FAILED. They cannot show a run that never
 * happened -- cron silently disabled, vercel.json dropped by a deploy, or the
 * project already paused. That is the case this guards, and it is the case
 * that actually bites, because it fails exactly when nobody is looking.
 *
 * Optional: unset KEEPALIVE_PING_URL and this is skipped, so there is no
 * third-party dependency by default. A failed ping never fails the run --
 * the database read is the point, and the ping is only the report of it.
 */
async function reportSuccess(): Promise<void> {
  const url = process.env.KEEPALIVE_PING_URL;
  if (!url) return;
  try {
    await fetch(url, { method: "POST", signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.error("Keepalive ran, but the dead-man's-switch ping failed:", err);
  }
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;

  // Fail closed. If CRON_SECRET is missing this must NOT fall through to an
  // unauthenticated database read -- a forgotten env var would quietly turn
  // this into an open endpoint anyone can point at the database.
  if (!expected) {
    console.error("CRON_SECRET is not set; refusing to run keepalive.");
    return NextResponse.json(
      { ok: false, error: "Keepalive is not configured" },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!secretsMatch(token, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient();
    // head: true sends no rows back -- we want the query to happen, not its
    // result. Service-role so this never depends on a user session.
    const { count, error } = await supabase
      .from("meditations")
      .select("*", { count: "exact", head: true });

    if (error) throw new Error(error.message);

    await reportSuccess();

    return NextResponse.json({
      ok: true,
      meditations: count ?? 0,
      at: new Date().toISOString(),
    });
  } catch (err) {
    // Surfaces as a failed cron run in the Vercel dashboard. The ping above
    // is what actually alerts; this is the log for afterwards.
    console.error("Keepalive failed:", err);
    return NextResponse.json(
      { ok: false, error: "Keepalive query failed" },
      { status: 500 },
    );
  }
}
