import { NextResponse } from "next/server";
import { getVoices } from "@/lib/voices/server";

/**
 * The voices the picker offers: the operator's ElevenLabs collection. The
 * same list gates /api/audio/generate, so the picker cannot offer a voice
 * generation would reject.
 */
export async function GET() {
  try {
    const voices = await getVoices();
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(voices, {
      headers: {
        "Cache-Control": isDev
          ? "no-store"
          : "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err) {
    console.error("Could not load voices:", err);
    return NextResponse.json({ error: "Could not load voices" }, { status: 502 });
  }
}
