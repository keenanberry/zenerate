import { toVoiceCatalog, type ElevenLabsVoice, type Voice } from "./catalog";

/**
 * The collection's voices, live from ElevenLabs. Cached for an hour through
 * the Next.js data cache, so editing the collection reaches the app within
 * the hour without a deploy. Throws if ElevenLabs is unreachable; callers
 * fail closed.
 */
export async function getVoices(): Promise<Voice[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ElevenLabs API key not configured");

  const res = await fetch(
    "https://api.elevenlabs.io/v2/voices?voice_type=non-default&page_size=100",
    { headers: { "xi-api-key": apiKey }, next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new Error(`ElevenLabs voices request failed: ${res.status}`);

  const body = (await res.json()) as { voices?: ElevenLabsVoice[] };
  return toVoiceCatalog(body.voices ?? []);
}
