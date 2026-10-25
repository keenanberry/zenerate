/** Where reports go: the same mailbox /privacy and /terms publish. */
export const REPORT_EMAIL = "privacy@zeneratestudio.com";

/**
 * The Report link on a public meditation (task 53): a mailto prefilled with
 * the meditation's title and URL, so the operator can find it and unlist it
 * by hand (tasks/OPERATOR-TODO.md). Encoded with encodeURIComponent rather
 * than URLSearchParams, whose "+" for a space some mail apps show literally.
 */
export function reportHref(meditation: { id: string; title: string }, siteUrl: URL | string) {
  const url = new URL(`/meditation/${meditation.id}`, siteUrl).href;
  const subject = `Report: ${meditation.title}`;
  const body = [
    "I'm reporting this public meditation on Zenerate:",
    "",
    meditation.title,
    url,
    "",
    "What's wrong with it:",
    "",
  ].join("\n");
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
