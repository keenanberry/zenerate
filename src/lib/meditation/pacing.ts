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
/**
 * A pair of numbers is a count only when punctuation or the end of the
 * speech follows it: "one, two." is, "Take two, three deep breaths" and
 * "seven, eight and nine" are not.
 */
const ENDS_BEAT = /^\s*(?:[.,;:!?…\-–—]|$)/;

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
/** "two and a half minutes", "five, maybe ten minutes": a length of time, not a count. */
const HALF_AFTER = /^\s*and\s+a\s+half\b/i;
const QUANTITY_IN_CLAUSE = /^[^.;:!?\n]{0,30}?\b(?:minutes?|hours?|days?|weeks?|months?|years?|breaths?|times|rounds?)\b/i;
/** "On the count of three, let go": a cue for one action, not a timed breath. */
const CUE_BEFORE = /\bon\s+the\s+$/i;
const CUE_AFTER = /^\s*,/;

/**
 * A line that explains the pattern before it starts ("We will breathe in for
 * four, hold for seven..."): no one is counting yet, so it needs no pause of
 * that length.
 */
const DESCRIBES = /\b(?:we will|we'll|you will|you'll|we are going to|we're going to|in this practice|this practice|the pattern|is called|each round|each cycle)\b/i;

const PAUSE_LINE = /^\*\[PAUSE:\s*(\d+)\s*seconds?\]\*$/i;
const MARKER_LINE = /^\*\[/;
/** How far ahead a multi-phase line's phases may be walked through, in lines. */
const PHASE_WINDOW = 16;

function countValue(token: string): number {
  const word = NUMBER_WORDS.indexOf(token.toLowerCase());
  return word >= 0 ? word + 1 : Number(token);
}

/** The timed instructions in one line, in order, as their counts. */
function timedCounts(text: string): number[] {
  const counts: number[] = [];
  for (const m of text.matchAll(INSTRUCTION)) {
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    if (HALF_AFTER.test(after) || QUANTITY_IN_CLAUSE.test(after)) continue;
    if (/^count/i.test(m[0]) && CUE_BEFORE.test(before) && CUE_AFTER.test(after)) continue;
    counts.push(countValue(m.slice(1).find(Boolean)!));
  }
  return counts;
}

export type PacingIssue = {
  /** 1-based line in the script. */
  line: number;
  /** The line as written, trimmed and cut to a readable length. */
  quote: string;
  kind: "count-chain" | "count-without-pause" | "phases-on-one-line";
  /** For count-without-pause: the seconds the count asks for, and the PAUSE found (null for speech). */
  countSeconds?: number;
  pauseSeconds?: number | null;
  /** For phases-on-one-line: each phase's count, in order. */
  phases?: number[];
};

function quote(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

type Spoken = { text: string; line: number; start: number };

/**
 * Runs of consecutive counts (each one more or one less than the last) with
 * only punctuation or spaces between them, inside one stretch of speech.
 * Consecutive spoken lines are read as one TTS call, so "Ten." and "Nine."
 * on adjacent lines with no PAUSE between are a chain too.
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
      (length === 2 && !DASH_ONLY.test(gaps[0]) && ENDS_BEAT.test(text.slice(tokens[j].end)));
    if (isCount) {
      const at = lineAt(tokens[i].start);
      issues.push({ line: at.line, quote: quote(at.text), kind: "count-chain" });
    }
    i = j + 1;
  }
  return issues;
}

/** Whether a PAUSE of `pause` seconds suits a count of `count`: within half of it either way. */
function fits(pause: number, count: number): boolean {
  return pause >= count * 0.5 && pause <= Math.ceil(count * 1.5);
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

  /** The next non-empty line after `index`, as its index, or -1. */
  const nextLine = (index: number) => lines.findIndex((l, i) => i > index && l !== "");
  /** The PAUSE right after a line: its seconds, null for speech, undefined for room (SILENCE, SOUND, the end, a spoken count). */
  const pauseAfter = (index: number): number | null | undefined => {
    const next = lines[nextLine(index)];
    if (next === undefined || (MARKER_LINE.test(next) && !PAUSE_LINE.test(next)) || BEAT_LINE.test(next)) {
      return undefined;
    }
    const pause = next.match(PAUSE_LINE);
    return pause ? Number(pause[1]) : null;
  };
  /**
   * Whether a SILENCE comes before the next speech: the line hands the
   * pattern to the listener for a practice of their own ("Now continue on
   * your own, in for four, out for six."), which needs no PAUSE per phase.
   */
  const handsOff = (index: number) => {
    for (let i = index + 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      if (!MARKER_LINE.test(lines[i])) return false;
      if (/^\*\[SILENCE:/i.test(lines[i])) return true;
    }
    return false;
  };
  const counted = (index: number) => {
    const text = lines[index];
    return text && !MARKER_LINE.test(text) && !DESCRIBES.test(text) ? timedCounts(text) : [];
  };

  /**
   * Whether the phases of a multi-phase line are then walked through, each
   * on its own line with a PAUSE that suits it: the line only explained the
   * pattern ("The rhythm is simple: in for four, out for six.").
   */
  const walkedThrough = (index: number, phases: number[]) => {
    let want = 0;
    for (let i = index + 1; i < lines.length && i <= index + PHASE_WINDOW && want < phases.length; i++) {
      if (!lines[i] || MARKER_LINE.test(lines[i])) continue;
      const counts = counted(i);
      if (counts.length === 0) continue;
      if (counts.length > 1 || counts[0] !== phases[want]) return false;
      const pause = pauseAfter(i);
      if (pause === null || (pause !== undefined && !fits(pause, counts[0]))) return false;
      want += 1;
    }
    return want === phases.length;
  };

  const chainLines = new Set(issues.map((issue) => issue.line));
  lines.forEach((text, index) => {
    if (chainLines.has(index + 1)) return;
    const counts = counted(index);
    if (counts.length === 0 || handsOff(index)) return;

    if (counts.length > 1) {
      if (!walkedThrough(index, counts)) {
        issues.push({ line: index + 1, quote: quote(text), kind: "phases-on-one-line", phases: counts });
      }
      return;
    }
    const pauseSeconds = pauseAfter(index);
    if (pauseSeconds === undefined || (pauseSeconds !== null && fits(pauseSeconds, counts[0]))) return;
    issues.push({
      line: index + 1,
      quote: quote(text),
      kind: "count-without-pause",
      countSeconds: counts[0],
      pauseSeconds,
    });
  });

  return issues.sort((a, b) => a.line - b.line);
}

/** One fix-it note per issue, for the agent. */
export function pacingNote(issue: PacingIssue): string {
  const at = `line ${issue.line} "${issue.quote}"`;
  if (issue.kind === "count-chain") {
    return `${at}: several counted beats in one breath. Put each number on its own line with its own PAUSE after it: about 1 second in a spoken breath count, about 2 seconds in a countdown.`;
  }
  if (issue.kind === "phases-on-one-line") {
    const pauses = issue.phases!.map((n) => `*[PAUSE: ${n} seconds]*`).join(", ");
    return `${at}: ${issue.phases!.length} timed phases on one line. Split each phase onto its own line with its own PAUSE (${pauses} in turn), never one pause for the whole cycle.`;
  }
  const wanted = `*[PAUSE: ${issue.countSeconds} seconds]*`;
  return issue.pauseSeconds === null
    ? `${at}: asks for a ${issue.countSeconds}-second count but goes straight on to speech. Follow it with ${wanted}.`
    : `${at}: asks for a ${issue.countSeconds}-second count but pauses ${issue.pauseSeconds} seconds. Make it ${wanted}.`;
}
