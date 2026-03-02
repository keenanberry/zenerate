"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoicePicker } from "@/components/voice-picker";
import { Loader2, Sparkles } from "lucide-react";

const DEFAULT_VOICE_ID = "Mu5jxyqZOLIGltFpfalg"; // Jameson

interface GenerateAudioPanelProps {
  meditationId: string;
  onStarted: () => void;
}

export function GenerateAudioPanel({
  meditationId,
  onStarted,
}: GenerateAudioPanelProps) {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditationId,
          voiceId: selectedVoiceId ?? DEFAULT_VOICE_ID,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to start audio generation");
      }

      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Generate Audio</h2>
          <p className="text-sm text-muted-foreground">
            Select a voice and generate the audio for your meditation.
          </p>
        </div>

        <VoicePicker
          selectedVoiceId={selectedVoiceId}
          onSelect={setSelectedVoiceId}
        />

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full gap-2"
          size="lg"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting generation...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Audio
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
