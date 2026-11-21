/**
 * The image prompt for a generated cover. The studio agent writes the
 * subject in its own words, never the person's verbatim; one shared style
 * line keeps every cover photographic and clean. Changing the line changes
 * what was approved (the spec holds it too).
 *
 * It never calls the picture a cover "for an app": FLUX read that as an app
 * icon and drew about one cover in three as a rounded tile on white, which
 * shows as white slivers in a card's rounded corners (cover art PR 3).
 */
export const COVER_STYLE =
  "Full-bleed square photograph filling the whole frame edge to edge. Photographic and realistic, natural light, calm, uncluttered composition with one clear subject and room to breathe. No rounded corners, no frame, no text, no letters, no logos, no borders, no watermark.";

/** How long a subject may be; the makeCover tool's input holds to the same. */
export const MAX_SUBJECT_CHARS = 300;

/** The subject (trimmed, capped) followed by the style line. */
export function coverPrompt(subject: string): string {
  const capped = subject.trim().slice(0, MAX_SUBJECT_CHARS).trim();
  return `${capped} ${COVER_STYLE}`;
}
