import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMeditation } from "@/lib/meditation/actions";
import { toDownloadFilename } from "@/lib/meditation/filename";

/**
 * Download a meditation's audio as an MP3 attachment.
 *
 * AUTHORIZATION
 *
 * This route performs no per-meditation permission check of its own, and must
 * not grow one. It calls `getMeditation`, which fetches the row through an RLS-bound client
 * -- so the row only comes back if the caller is entitled to it, meaning they
 * own it or it is public. If the fetch throws or returns nothing, there is
 * nothing to serve. Authorization is structural here rather than a check that
 * could be forgotten or get out of step with the policies.
 *
 * What this route must NEVER do is construct a storage path from `id` and sign
 * it. `@/lib/audio/signed-url` signs with a service-role client and performs
 * no authorization whatsoever, so signing `${id}.mp3` straight from the route
 * param would hand any caller any user's private audio. An ESLint rule
 * restricts that module to `src/lib/meditation/actions.ts` precisely to stop a
 * route like this one importing it -- and since task 18c that rule also
 * catches relative paths and dynamic `import()`, so there is no accidental way
 * around it. Go through the authorized fetcher.
 *
 * The one check it does make -- "is anyone signed in?" -- is product policy,
 * not authorization. Since task 18b, signed-out visitors can read public
 * meditations, so `getMeditation` alone would serve them downloads; keeping a
 * copy is reserved for accounts. It protects nothing: an anonymous listener
 * already holds the signed URL the player streams from. Do not lean on it.
 *
 * WHY A ROUTE RATHER THAN `<a download>`
 *
 * The bucket is private, so the browser cannot fetch the object directly. Even
 * with a signed URL in hand, iOS Safari ignores the `download` attribute on
 * cross-origin links and navigates to the file instead of saving it. Streaming
 * it back from our own origin with Content-Disposition is what actually works
 * on a phone -- which is the whole point of the feature.
 */

/**
 * Never cache. The response is a specific user's audio, selected by their
 * session: a shared cache entry here would serve one user's private
 * meditation to the next caller with the same URL.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let meditation;
  try {
    meditation = await getMeditation(id);
  } catch {
    // Covers both "no such row" and "row exists but RLS hides it from you".
    // Deliberately the same 404 either way -- distinguishing them would tell
    // an anonymous caller which meditation ids exist.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!meditation?.audio_url) {
    // Either audio was never generated, or signing failed. Both mean there is
    // nothing to download; neither is an error worth alarming the user with.
    return NextResponse.json({ error: "No audio available" }, { status: 404 });
  }

  const upstream = await fetch(meditation.audio_url);
  if (!upstream.ok || !upstream.body) {
    console.error(
      `Download failed for meditation ${id}: storage responded ${upstream.status}`,
    );
    return NextResponse.json(
      { error: "Could not retrieve audio" },
      { status: 502 },
    );
  }

  const filename = toDownloadFilename(meditation.title);
  const headers = new Headers({
    "Content-Type": "audio/mpeg",
    // `filename` is slugified to [a-z0-9-] plus the .mp3 suffix, so it cannot
    // contain a quote, semicolon or newline that would break out of this
    // header. See src/lib/meditation/filename.ts.
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  });

  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  // Stream rather than buffer -- a 20-minute meditation is several megabytes,
  // and reading it fully into memory would scale with concurrent downloads.
  return new Response(upstream.body, { status: 200, headers });
}
