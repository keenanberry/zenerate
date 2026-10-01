/**
 * Turn a meditation title into a safe download filename stem.
 *
 * The output lands in a `Content-Disposition: attachment; filename="..."`
 * header, so it has to survive two things: the header itself (a stray quote or
 * newline would break or let someone forge the header), and whatever
 * filesystem the browser saves to. Titles are user-supplied and this app is
 * public, so neither can be assumed well-behaved.
 *
 * ASCII-only on purpose. A title like "朝の瞑想" slugifies to nothing, which is
 * why there is a fallback rather than an empty filename -- see below.
 */
const MAX_STEM_LENGTH = 60;
const FALLBACK_STEM = "meditation";

export function toDownloadFilename(title: string | null | undefined): string {
  const stem = slugify(title ?? "");
  return `${stem || FALLBACK_STEM}.mp3`;
}

function slugify(input: string): string {
  return (
    input
      // Split accented characters into base + combining mark, then drop the
      // marks, so "Café" becomes "cafe" rather than "caf".
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Anything that is not a-z, 0-9 becomes a separator. This is an
      // allowlist rather than a denylist of "bad" characters: quotes,
      // newlines, path separators, control characters and every
      // not-yet-imagined problem character all fail the same test.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_STEM_LENGTH)
      // Slicing can leave a trailing separator ("a-very-long-title-" ), so trim
      // again after truncating rather than before.
      .replace(/-+$/g, "")
  );
}
