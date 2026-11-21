/**
 * The image prompt for a generated cover. The studio agent writes the
 * subject in its own words, never the person's verbatim; one shared style
 * line keeps every cover photographic and clean. The line is the one the
 * model comparison used, so changing it changes what was approved.
 */
export const COVER_STYLE =
  "Square cover image for a guided meditation app. Photographic and realistic, natural light, calm, uncluttered composition with one clear subject and room to breathe. No text, no letters, no logos, no borders, no watermark.";

/** How long a subject may be; the makeCover tool's input holds to the same. */
export const MAX_SUBJECT_CHARS = 300;

/** The subject (trimmed, capped) followed by the style line. */
export function coverPrompt(subject: string): string {
  const capped = subject.trim().slice(0, MAX_SUBJECT_CHARS).trim();
  return `${capped} ${COVER_STYLE}`;
}
