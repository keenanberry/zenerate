import { gateway, generateImage } from "ai";
import { COVER_MODEL } from "./model";
import { coverPrompt, type CoverStyle } from "./prompt";

/** Longer than this and the person has moved on; the studio says it failed. */
const GENERATE_TIMEOUT_MS = 30_000;

export type GeneratedImage = { bytes: Uint8Array; mediaType: string };

/**
 * One square cover from `subject` in `style`, as the provider returned it. storeCover
 * re-encodes it to WebP at two sizes, so the provider's format does not
 * matter here. Auth is the Gateway's own: a deployment's OIDC token, or
 * `VERCEL_OIDC_TOKEN` / `AI_GATEWAY_API_KEY` locally (.env.example).
 *
 * Throws on a provider refusal, a rate limit or the timeout; the caller
 * releases the generation it reserved.
 */
export async function generateCover(subject: string, style: CoverStyle = "photograph"): Promise<GeneratedImage> {
  const { image } = await generateImage({
    model: gateway.imageModel(COVER_MODEL),
    prompt: coverPrompt(subject, style),
    aspectRatio: "1:1",
    // The Gateway's free tier allows 5 image requests a minute; one retry
    // covers a blip without stacking requests against that limit.
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
  });
  return { bytes: image.uint8Array, mediaType: image.mediaType };
}
