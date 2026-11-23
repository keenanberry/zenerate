/**
 * Counts the narrator would rattle off. ElevenLabs does not pause for "..."
 * or commas; only a PAUSE line makes real silence. So a countdown written
 * as "ten... nine... eight." or a breath count with no PAUSE after it plays
 * as one quick phrase. The studio reports these back to the model as fix-it
 * notes (reviewScript in src/lib/chat/tools.ts).
 *
 * Deliberately conservative: a false positive costs the person a slow
 * rewrite. Prose numbers ("one breath at a time", "two or three minutes",
 * "4-7-8 breathing") stay clean.
 */

const NUMBER_WORDS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty",
];

/** A count from 1 to 20, as digits or a word, never part of a larger number. */
const COUNT = `(?:${NUMBER_WORDS.join("|")}|20|1[0-9]|[1-9])`;
const COUNT_TOKEN = new RegExp(`(?<!\\w)(?<!\\d\\.)${COUNT}(?!\\w)(?!\\.\\d)`, "gi");

/** What may sit between two beats of one count: ellipses, commas, dashes, stops, spaces. */
const BEAT_SEPARATOR = /^[\s.,…;:!\-–—]+$/;
/** A bare dash between two numbers is a range or a name ("2-3", "4-7-8"), not a count. */
const DASH_ONLY = /^\s*[-–—]\s*$/;
/** "two, three minutes" is a quantity, not a count. */
const UNIT_AFTER = /^\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?|times|breaths?|more|of)\b/i;

/** A line that is only a beat of a spoken count: "Ten.", "And one…". */
const BEAT_LINE = new RegExp(`^(?:and\\s+)?${COUNT}[\\s.,…!]*$`, "i");

/**
 * A timed breath or count instruction and its number: "for a count of four",
 * "in for 4", "hold for 7 counts", "four counts", "counting to six", "for
 * five seconds". "for" must end the phrase (or take counts/beats/seconds), so
 * "for one breath" and "for two or three minutes" do not match.
 */
const INSTRUCTION = new RegExp(
  [
    `\\bcount\\s+of\\s+(${COUNT})\\b`,
    `\\bcount(?:ing)?\\s+to\\s+(${COUNT})\\b`,
    `\\bfor\\s+(${COUNT})(?:\\s+(?:counts?|beats?|seconds?))?(?=\\s*(?:[.,;:!…—–-]|$|and\\b))`,
    `\\b(${COUNT})\\s+(?:counts|beats)\\b`,
  ].join("|"),
  "gi",
);

/**
 * A line that explains the pattern before it starts ("We will breathe in for
 * four, hold for seven..."): no one is counting yet, so it needs no pause of
 * that length.
 */
const DESCRIBES = /\b(?:we will|we'll|you will|you'll|we are going to|we're going to|in this practice|this practice|the pattern|is called|each round|each cycle)\b/i;

const PAUSE_LINE = /^\*\[PAUSE:\s*(\d+)\s*seconds?\]\*$/i;
const MARKER_LINE = /^\*\[/;

function countValue(token: string): number {
  const word = NUMBER_WORDS.indexOf(token.toLowerCase());
  return word >= 0 ? word + 1 : Number(token);
}

export type PacingIssue = {
  /** 1-based line in the script. */
  line: number;
  /** The line as written, trimmed and cut to a readable length. */
  quote: string;
  kind: "count-chain" | "count-without-pause";
  /** For count-without-pause: the seconds the count asks for, and the PAUSE found (null for speech). */
  countSeconds?: number;
  pauseSeconds?: number | null;
};

function quote(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

type Spoken = { text: string; line: number; start: number };

/**
 * Runs of two or more consecutive counts (each one more or one less than the
 * last) with only punctuation or spaces between them, inside one stretch of
 * speech. Consecutive spoken lines are read as one TTS call, so "Ten." and
 * "Nine." on adjacent lines with no PAUSE between are a chain too.
 */
function findChains(stretch: Spoken[]): PacingIssue[] {
  const text = stretch.map((s) => s.text).join(" ");
  const lineAt = (offset: number) => stretch.findLast((s) => s.start <= offset) ?? stretch[0];
  const tokens = [...text.matchAll(COUNT_TOKEN)].map((m) => ({
    value: countValue(m[0]),
    start: m.index,
    end: m.index + m[0].length,
  }));

  const issues: PacingIssue[] = [];
  let i = 0;
  while (i < tokens.length) {
    let j = i;
    let step = 0;
    const gaps: string[] = [];
    while (j + 1 < tokens.length) {
      const gap = text.slice(tokens[j].end, tokens[j + 1].start);
      const diff = tokens[j + 1].value - tokens[j].value;
      if (!BEAT_SEPARATOR.test(gap) || Math.abs(diff) !== 1 || (step !== 0 && diff !== step)) break;
      step = diff;
      gaps.push(gap);
      j += 1;
    }
    const length = j - i + 1;
    const isCount =
      length >= 3 ||
      (length === 2 && !DASH_ONLY.test(gaps[0]) && !UNIT_AFTER.test(text.slice(tokens[j].end)));
    if (isCount) {
      const at = lineAt(tokens[i].start);
      issues.push({ line: at.line, quote: quote(at.text), kind: "count-chain" });
    }
    i = j + 1;
  }
  return issues;
}

/**
 * Every pacing problem in a script, in line order. Pure, so the tests and
 * scripts/measure-pacing.ts call it directly.
 */
export function findPacingIssues(script: string): PacingIssue[] {
  const lines = script.split("\n").map((l) => l.trim());
  const issues: PacingIssue[] = [];

  // Stretches of speech the parser would join into one TTS call.
  let stretch: Spoken[] = [];
  let offset = 0;
  const flush = () => {
    if (stretch.length > 0) issues.push(...findChains(stretch));
    stretch = [];
    offset = 0;
  };
  lines.forEach((text, index) => {
    if (!text) return;
    if (MARKER_LINE.test(text)) return flush();
    stretch.push({ text, line: index + 1, start: offset });
    offset += text.length + 1;
  });
  flush();

  const chainLines = new Set(issues.map((issue) => issue.line));
  lines.forEach((text, index) => {
    if (!text || MARKER_LINE.test(text) || chainLines.has(index + 1) || DESCRIBES.test(text)) return;
    const counts = [...text.matchAll(INSTRUCTION)].map((m) => countValue(m.slice(1).find(Boolean)!));
    if (counts.length === 0) return;
    const seconds = counts.reduce((sum, n) => sum + n, 0);

    const next = lines.slice(index + 1).find(Boolean);
    // The end of the script, a SILENCE or a SOUND leaves room; a spoken
    // count ("One." on the next line) is checked as a chain instead.
    if (next === undefined || (MARKER_LINE.test(next) && !PAUSE_LINE.test(next)) || BEAT_LINE.test(next)) return;
    const pause = next.match(PAUSE_LINE);
    const pauseSeconds = pause ? Number(pause[1]) : null;
    if (pauseSeconds !== null && pauseSeconds >= seconds * 0.5 && pauseSeconds <= Math.ceil(seconds * 1.5)) return;
    issues.push({
      line: index + 1,
      quote: quote(text),
      kind: "count-without-pause",
      countSeconds: seconds,
      pauseSeconds,
    });
  });

  return issues.sort((a, b) => a.line - b.line);
}

/** One fix-it note per issue, for the agent. */
export function pacingNote(issue: PacingIssue): string {
  if (issue.kind === "count-chain") {
    return `line ${issue.line} "${issue.quote}": several counted beats in one breath. Put each number on its own line with its own *[PAUSE: 2 seconds]* after it.`;
  }
  const wanted = `*[PAUSE: ${issue.countSeconds} seconds]*`;
  return issue.pauseSeconds === null
    ? `line ${issue.line} "${issue.quote}": asks for a ${issue.countSeconds}-second count but goes straight on to speech. Follow it with ${wanted}.`
    : `line ${issue.line} "${issue.quote}": asks for a ${issue.countSeconds}-second count but pauses ${issue.pauseSeconds} seconds. Make it ${wanted}.`;
}
