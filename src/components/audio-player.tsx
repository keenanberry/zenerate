import { Volume2 } from "lucide-react";

export function AudioPlayer() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/50 p-6">
      <Volume2 className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Audio generation coming soon
        </p>
        <p className="text-xs text-muted-foreground/70">
          The audio pipeline is under development. Once ready, your meditation
          script will be converted to a full audio experience with TTS, sound
          effects, and background music.
        </p>
      </div>
    </div>
  );
}
