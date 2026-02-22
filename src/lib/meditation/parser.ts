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
