import { NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const MEDITATION_VOICE_NAMES = new Set([
  "Sarah",
  "Brian",
  "River",
  "George",
  "Bill",
  "Lily",
]);

const VOICE_DESCRIPTIONS: Record<string, string> = {
  Sarah: "Mature and reassuring — calm, steady presence",
  Brian: "Deep, resonant and comforting — ideal for relaxation",
  River: "Relaxed and neutral — soothing, informative tone",
  George: "Warm, captivating storyteller — gentle and inviting",
  Bill: "Wise and balanced — grounded, mature delivery",
  Lily: "Velvety and smooth — soft, expressive warmth",
};

export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key not configured" },
      { status: 500 },
    );
  }

  const client = new ElevenLabsClient({ apiKey });
  const response = await client.voices.getAll();
  const allVoices = response.voices ?? [];

  const voices = allVoices
    .filter((v) => {
      const firstName = v.name?.split(" ")[0] ?? "";
      return v.category === "premade" && MEDITATION_VOICE_NAMES.has(firstName);
    })
    .map((v) => {
      const firstName = v.name?.split(" ")[0] ?? "Unknown";
      return {
        voiceId: v.voiceId,
        name: firstName,
        description: VOICE_DESCRIPTIONS[firstName] ?? "",
        gender: v.labels?.gender ?? "unknown",
        previewUrl: v.previewUrl ?? null,
      };
    });

  const isDev = process.env.NODE_ENV === "development";

  return NextResponse.json(voices, {
    headers: {
      "Cache-Control": isDev
        ? "no-store"
        : "public, max-age=3600, s-maxage=3600",
    },
  });
}
