import { MeditationSegment } from "./types";

export function parseMeditationText(text: string): MeditationSegment[] {
  const segments: MeditationSegment[] = [];
  const lines = text.split("\n");
  let currentSpeech: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    const pauseMatch = trimmedLine.match(
      /^\*\[PAUSE:\s*(\d+)\s*seconds?\]\*$/i
    );
    if (pauseMatch) {
      if (currentSpeech.length > 0) {
        segments.push({
          type: "speech",
          content: currentSpeech.join(" ").trim(),
        });
        currentSpeech = [];
      }
      segments.push({ type: "pause", duration: parseInt(pauseMatch[1]) });
      continue;
    }

    const silenceMatch = trimmedLine.match(
      /^\*\[SILENCE:\s*(\d+)\s*minutes?\]\*$/i
    );
    if (silenceMatch) {
      if (currentSpeech.length > 0) {
        segments.push({
          type: "speech",
          content: currentSpeech.join(" ").trim(),
        });
        currentSpeech = [];
      }
      segments.push({
        type: "silence",
        duration: parseInt(silenceMatch[1]) * 60,
      });
      continue;
    }

    const soundMatch = trimmedLine.match(/^\*\[SOUND:\s*(.+?)\]\*$/i);
    if (soundMatch) {
      if (currentSpeech.length > 0) {
        segments.push({
          type: "speech",
          content: currentSpeech.join(" ").trim(),
        });
        currentSpeech = [];
      }
      segments.push({ type: "sound", file: soundMatch[1] });
      continue;
    }

    if (trimmedLine && !trimmedLine.startsWith("*[")) {
      currentSpeech.push(trimmedLine);
    }
  }

  if (currentSpeech.length > 0) {
    segments.push({
      type: "speech",
      content: currentSpeech.join(" ").trim(),
    });
  }

  return segments;
}

const MARKER_LINE = [
  /^\*\[PAUSE:\s*(\d+)\s*seconds?\]\*$/i,
  /^\*\[SILENCE:\s*(\d+)\s*minutes?\]\*$/i,
  /^\*\[SOUND:\s*(.+?)\]\*$/i,
];

/**
 * Lines that look like markup but that `parseMeditationText` will not treat as
 * a marker. A line starting with `*[` that fails every pattern is dropped
 * silently; a marker written inside a sentence stays in the speech and is read
 * aloud. Either way the script loses or garbles content without an error, so
 * the studio reports these back to the model to fix.
 */
export function findMalformedMarkers(text: string): string[] {
  const malformed: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (MARKER_LINE.some((pattern) => pattern.test(trimmed))) continue;
    if (
      trimmed.startsWith("*[") ||
      /\[\s*(PAUSE|SILENCE|SOUND)\b/i.test(trimmed)
    ) {
      malformed.push(trimmed);
    }
  }
  return malformed;
}
