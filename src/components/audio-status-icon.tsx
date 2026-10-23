import { CircleAlert, FileText, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/*
 * A meditation with playable audio is the normal case and shows nothing. The
 * exceptions get one small icon (task 54): a script with no audio yet, audio
 * being made, or audio that failed.
 */
const LOOKS: Record<string, { icon: typeof FileText; label: string; className: string }> = {
  script_ready: { icon: FileText, label: "Script only, no audio yet", className: "text-muted-foreground" },
  generating_script: { icon: Loader2, label: "Writing the script", className: "text-muted-foreground motion-safe:animate-spin" },
  processing_audio: { icon: Loader2, label: "Making the audio", className: "text-primary motion-safe:animate-spin" },
  failed: { icon: CircleAlert, label: "Audio failed", className: "text-destructive" },
};

export function AudioStatusIcon({ status, className }: { status: string; className?: string }) {
  const look = LOOKS[status];
  if (!look) return null;
  const Icon = look.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={look.label} className={cn("inline-flex shrink-0", className)}>
          <Icon aria-hidden className={cn("size-3.5", look.className)} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{look.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
