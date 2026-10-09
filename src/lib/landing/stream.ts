/** Words in `text`: runs of non-whitespace. */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/**
 * The prefix of `text` holding its first `n` words, with the original
 * whitespace (and so the line breaks the script parser reads) kept. Stops at
 * the end of the nth word, so a reveal never shows half a word.
 */
export function revealWords(text: string, n: number): string {
  if (n <= 0) return "";
  const word = /\S+/g;
  let end = 0;
  for (let i = 0; i < n; i++) {
    const match = word.exec(text);
    if (!match) return text;
    end = match.index + match[0].length;
  }
  return text.slice(0, end);
}
