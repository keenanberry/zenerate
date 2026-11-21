/**
 * The image prompt for a generated cover. The studio agent writes the
 * subject in its own words, never the person's verbatim, and picks one of
 * the shared style lines: a photograph by default, a storybook illustration
 * for a children's meditation. Changing a line changes what was approved
 * (the spec holds them too).
 *
 * Neither line calls the picture a cover "for an app": FLUX read that as an
 * app icon and drew about one cover in three as a rounded tile on white,
 * which shows as white slivers in a card's rounded corners (cover art PR 3).
 */
export const COVER_STYLES = {
  photograph:
    "Full-bleed square photograph filling the whole frame edge to edge. Photographic and realistic, natural light, calm, uncluttered composition with one clear subject and room to breathe. No rounded corners, no frame, no text, no letters, no logos, no borders, no watermark.",
  illustration:
    "Full-bleed square illustration filling the whole frame edge to edge. Soft storybook illustration, gentle painterly textures, warm calm colours, friendly and simple shapes, one clear subject with room to breathe. No rounded corners, no frame, no text, no letters, no logos, no borders, no watermark.",
} as const;

/** A cover's style: a key of COVER_STYLES. */
export type CoverStyle = keyof typeof COVER_STYLES;

/** Every style, for a zod enum or an argument check. */
export const COVER_STYLE_NAMES = Object.keys(COVER_STYLES) as [CoverStyle, ...CoverStyle[]];

/** The photograph line, every cover's style before the illustration one. */
export const COVER_STYLE = COVER_STYLES.photograph;

/** How long a subject may be; the makeCover tool's input holds to the same. */
export const MAX_SUBJECT_CHARS = 300;

/** The subject (trimmed, capped) followed by the style's line. */
export function coverPrompt(subject: string, style: CoverStyle = "photograph"): string {
  const capped = subject.trim().slice(0, MAX_SUBJECT_CHARS).trim();
  return `${capped} ${COVER_STYLES[style]}`;
}
