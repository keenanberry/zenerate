import { describe, it, expect } from "vitest";
import { findPacingIssues, pacingNote } from "./pacing";

const lines = (...l: string[]) => l.join("\n\n");

describe("findPacingIssues: real failures", () => {
  it("flags a sleep countdown written as ellipsis chains", () => {
    const script = lines(
      "Let's count down together, from ten to one.",
      "ten... nine... eight.\nseven... six... five.",
      "*[PAUSE: 5 seconds]*",
    );
    const issues = findPacingIssues(script);
    // Both lines are one speech segment, so ten to five is one chain.
    expect(issues.map((i) => [i.line, i.kind])).toEqual([[3, "count-chain"]]);
    expect(issues[0].quote).toBe("ten... nine... eight.");
  });

  it("flags a spoken breath count on one line", () => {
    const script = lines(
      "Now exhale to the count of six... 1... 2... 3... 4... 5... 6.",
      "*[PAUSE: 3 seconds]*",
    );
    expect(findPacingIssues(script)).toEqual([
      expect.objectContaining({ line: 1, kind: "count-chain" }),
    ]);
  });

  it("flags count beats on adjacent lines with no PAUSE between, since they are one TTS call", () => {
    const script = "Ten.\nNine.\nEight.\n\n*[PAUSE: 3 seconds]*";
    expect(findPacingIssues(script)).toEqual([expect.objectContaining({ line: 1, kind: "count-chain" })]);
  });

  it("flags comma and unicode-ellipsis counts", () => {
    expect(findPacingIssues("Breathe in, 1, 2, 3, and out.")).toHaveLength(1);
    expect(findPacingIssues("one… two… three…")).toHaveLength(1);
    expect(findPacingIssues("Ten...nine...eight")).toHaveLength(1);
  });

  it("flags box breathing with no pauses between the sides", () => {
    const script = lines(
      "Breathe in for a count of four.",
      "Hold for a count of four.",
      "Breathe out for a count of four.",
      "Hold for four.",
      "*[PAUSE: 4 seconds]*",
    );
    const issues = findPacingIssues(script);
    expect(issues.map((i) => [i.line, i.kind, i.pauseSeconds])).toEqual([
      [1, "count-without-pause", null],
      [3, "count-without-pause", null],
      [5, "count-without-pause", null],
    ]);
    expect(pacingNote(issues[0])).toBe(
      'line 1 "Breathe in for a count of four.": asks for a 4-second count but goes straight on to speech. Follow it with *[PAUSE: 4 seconds]*.',
    );
  });

  it("flags 4-7-8 breathing whose pauses do not match the counts", () => {
    const script = lines(
      "This is 4-7-8 breathing.",
      "*[PAUSE: 2 seconds]*",
      "Breathe in through your nose for 4.",
      "*[PAUSE: 4 seconds]*",
      "Hold for 7 counts.",
      "*[PAUSE: 2 seconds]*",
      "Exhale through your mouth for eight.",
      "Again.",
    );
    const issues = findPacingIssues(script);
    expect(issues.map((i) => [i.line, i.countSeconds, i.pauseSeconds])).toEqual([
      [9, 7, 2],
      [13, 8, null],
    ]);
    expect(pacingNote(issues[0])).toMatch(/pauses 2 seconds\. Make it \*\[PAUSE: 7 seconds\]\*/);
  });

  it("flags several timed phases on one line, asking for a split rather than a summed pause", () => {
    const script = lines("Let's breathe in for four, hold for seven, and out for eight.", "*[PAUSE: 3 seconds]*");
    const issues = findPacingIssues(script);
    expect(issues).toEqual([expect.objectContaining({ line: 1, kind: "phases-on-one-line", phases: [4, 7, 8] })]);
    expect(pacingNote(issues[0])).toBe(
      'line 1 "Let\'s breathe in for four, hold for seven, and out for eight.": 3 timed phases on one line. ' +
        "Split each phase onto its own line with its own PAUSE (*[PAUSE: 4 seconds]*, *[PAUSE: 7 seconds]*, " +
        "*[PAUSE: 8 seconds]* in turn), never one pause for the whole cycle.",
    );
    expect(pacingNote(issues[0])).not.toMatch(/19/);
    // A pause the length of the whole cycle is still one pause for three phases.
    expect(findPacingIssues(lines("In for 4, hold for 7, out for 8.", "*[PAUSE: 19 seconds]*"))).toEqual([
      expect.objectContaining({ kind: "phases-on-one-line" }),
    ]);
  });

  it("flags a multi-phase line whose phases are walked through without their pauses", () => {
    const script = lines(
      "The rhythm is simple: in for four, out for six.",
      "*[PAUSE: 3 seconds]*",
      "Breathe in for four.",
      "*[PAUSE: 4 seconds]*",
      "And out for six.",
      "Again.",
    );
    expect(findPacingIssues(script).map((i) => [i.line, i.kind])).toEqual([
      [1, "phases-on-one-line"],
      [9, "count-without-pause"],
    ]);
  });

  it("words the chain note for both kinds of count", () => {
    expect(pacingNote(findPacingIssues("one, two, three")[0])).toMatch(
      /own line with its own PAUSE after it: about 1 second in a spoken breath count, about 2 seconds in a countdown\.$/,
    );
  });

  it("flags a pause far longer than the count", () => {
    const script = lines("Breathe in for four.", "*[PAUSE: 15 seconds]*");
    expect(findPacingIssues(script)).toEqual([
      expect.objectContaining({ kind: "count-without-pause", countSeconds: 4, pauseSeconds: 15 }),
    ]);
  });
});

describe("findPacingIssues: clean controls", () => {
  it("passes a countdown with a PAUSE after every number", () => {
    const words = ["Ten", "Nine", "Eight", "Seven", "Six", "Five", "Four", "Three", "Two", "One"];
    const script = lines(
      "Let's count down together, from ten to one.",
      "*[PAUSE: 2 seconds]*",
      ...words.flatMap((w) => [`${w}.`, "*[PAUSE: 2 seconds]*"]),
      "Rest here.",
    );
    expect(findPacingIssues(script)).toEqual([]);
  });

  it("passes a silent paced breath whose pauses match the counts", () => {
    const script = lines(
      "Breathe in through your nose for a count of four.",
      "*[PAUSE: 4 seconds]*",
      "Hold for four.",
      "*[PAUSE: 4 seconds]*",
      "And out, slowly, for a count of six.",
      "*[PAUSE: 6 seconds]*",
      "Breathe in, counting to five.",
      "*[PAUSE: 6 seconds]*",
    );
    expect(findPacingIssues(script)).toEqual([]);
  });

  it("passes a spoken breath count with a pause after each number", () => {
    const script = lines(
      "Exhale to the count of four.",
      "One.",
      "*[PAUSE: 1 second]*",
      "Two.",
      "*[PAUSE: 1 second]*",
      "Three.",
      "*[PAUSE: 1 second]*",
      "Four.",
      "*[PAUSE: 1 second]*",
    );
    expect(findPacingIssues(script)).toEqual([]);
  });

  it("passes ordinary prose with numbers", () => {
    const script = lines(
      "Take this one breath at a time.",
      "Rest here for two or three minutes, or for twenty minutes if you like.",
      "Notice five things you can see, four things you can hear, three you can touch.",
      "On March 3, 2024, or on any day, you can return to this.",
      "This practice is called 4-7-8 breathing, and it takes 2-3 minutes.",
      "Stay with this for one breath, then two, three breaths.",
      "One by one, let each thought go. Twenty-one breaths, or nine, or none.",
      "Feel your two feet and your ten toes.",
      "Every breath counts.",
      "*[PAUSE: 5 seconds]*",
    );
    expect(findPacingIssues(script)).toEqual([]);
  });

  it("passes a multi-phase line when each phase then gets its own line and pause", () => {
    const phases = (...first: string[]) =>
      lines(
        ...first,
        "*[PAUSE: 3 seconds]*",
        "Breathe in through your nose for four.",
        "*[PAUSE: 4 seconds]*",
        "Hold for seven.",
        "*[PAUSE: 7 seconds]*",
        "Let it out slowly through your mouth for eight.",
        "*[PAUSE: 8 seconds]*",
      );
    expect(findPacingIssues(phases("Let's breathe in for four, hold for seven, and out for eight."))).toEqual([]);
    expect(
      findPacingIssues(
        lines(
          "The rhythm is simple: in for four, out for six.",
          "*[PAUSE: 3 seconds]*",
          "Settle your shoulders first.",
          "*[PAUSE: 3 seconds]*",
          "Breathe in for four.",
          "*[PAUSE: 4 seconds]*",
          "And out for six.",
          "*[PAUSE: 6 seconds]*",
        ),
      ),
    ).toEqual([]);
    expect(
      findPacingIssues(
        lines(
          "Here's how it works: in for four, hold for four.",
          "*[PAUSE: 3 seconds]*",
          "In for four.",
          "*[PAUSE: 4 seconds]*",
          "Hold for four.",
          "*[PAUSE: 4 seconds]*",
        ),
      ),
    ).toEqual([]);
  });

  it("passes a pattern handed to the listener for a silent practice", () => {
    const script = lines(
      "Now continue on your own, in for four, out for six. I will be quiet.",
      "*[PAUSE: 3 seconds]*",
      "*[SILENCE: 2 minutes]*",
      "Keep breathing in for four on your own.",
      "*[SILENCE: 1 minute]*",
    );
    expect(findPacingIssues(script)).toEqual([]);
  });

  it("passes number pairs followed by a word, lengths of time and cues", () => {
    const script = lines(
      "Take two, three deep breaths.",
      "Take one, two steps forward.",
      "Lines seven, eight and nine.",
      "Rest here for two and a half minutes.",
      "Stay with this for five, maybe ten minutes.",
      "On the count of three, let everything go.",
      "*[PAUSE: 5 seconds]*",
    );
    expect(findPacingIssues(script)).toEqual([]);
  });

  it("passes a line that explains the pattern before the practice starts", () => {
    const script = lines(
      "In this practice, we breathe in for a count of four, and out for a count of six.",
      "*[PAUSE: 4 seconds]*",
      "We will breathe in for four, hold for seven, and out for eight.",
      "*[PAUSE: 5 seconds]*",
      "We will breathe in a square. In for four, hold for four, out for four, hold for four.",
      "Let's begin.",
    );
    expect(findPacingIssues(script)).toEqual([]);
  });

  it("does not ask for a pause before a SILENCE, a SOUND or the end", () => {
    expect(findPacingIssues(lines("Breathe in for four.", "*[SILENCE: 2 minutes]*"))).toEqual([]);
    expect(findPacingIssues(lines("Breathe in for four.", "*[SOUND: bell-tibetan.mp3]*"))).toEqual([]);
    expect(findPacingIssues("Breathe in for four.")).toEqual([]);
  });

  it("accepts a pause within half again of the count", () => {
    expect(findPacingIssues(lines("Breathe out for six.", "*[PAUSE: 3 seconds]*"))).toEqual([]);
    expect(findPacingIssues(lines("Breathe out for six.", "*[PAUSE: 9 seconds]*"))).toEqual([]);
    expect(findPacingIssues(lines("Breathe out for six.", "*[PAUSE: 2 seconds]*"))).toHaveLength(1);
  });
});
