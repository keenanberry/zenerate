"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Square, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Voice } from "@/lib/voices/catalog";

interface VoicePickerProps {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
}

export function VoicePicker({ selectedVoiceId, onSelect }: VoicePickerProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function fetchVoices() {
      try {
        const res = await fetch("/api/voices");
        if (!res.ok) throw new Error("Failed to load voices");
        const data = await res.json();
        setVoices(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load voices");
      } finally {
        setLoading(false);
      }
    }
    fetchVoices();
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function togglePreview(voice: Voice) {
    if (playingId === voice.voiceId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    audioRef.current?.pause();

    if (!voice.previewUrl) return;

    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    setPlayingId(voice.voiceId);

    audio.play();
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading voices...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Choose a voice</h3>
        {selectedVoiceId && (
          <Badge variant="secondary" className="text-xs">
            {voices.find((v) => v.voiceId === selectedVoiceId)?.name ?? "Selected"}
          </Badge>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {voices.map((voice) => {
          const isSelected = selectedVoiceId === voice.voiceId;
          const isPlaying = playingId === voice.voiceId;

          return (
            <Card
              key={voice.voiceId}
              className={cn(
                "cursor-pointer p-4 hover:bg-card-hover motion-safe:transition-colors",
                isSelected && "border-primary bg-card-hover ring-1 ring-primary/30",
              )}
              onClick={() => onSelect(voice.voiceId)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    isSelected
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{voice.name}</span>
                    <Badge variant="outline" className="capitalize">
                      {voice.gender}
                    </Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {voice.description}
                  </p>
                </div>
                {voice.previewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePreview(voice);
                    }}
                  >
                    {isPlaying ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
