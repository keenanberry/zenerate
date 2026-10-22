"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AudioPlayer } from "@/components/audio-player";
import { ScriptViewer } from "@/components/script-viewer";
import { ScriptPlaybackProvider } from "@/components/script-playback";
import { deleteMeditationVersion } from "@/lib/meditation/actions";
import type { MeditationVersion } from "@/lib/meditation/types";
import { cn } from "@/lib/utils";

type Version = MeditationVersion & { audio_url: string | null };

function versionLabel(createdAt: string) {
  return new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Earlier versions, for the owner. The page above always shows the current
 * version; picking one here plays that version's audio and shows its script
 * in place, with its own playback so the two scripts never light up together.
 */
export function VersionSwitcher({
  meditationId,
  title,
  versions,
}: {
  meditationId: string;
  title: string;
  versions: Version[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = versions.find((v) => v.id === selectedId) ?? null;

  function select(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setConfirming(false);
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteMeditationVersion(id);
        setSelectedId(null);
        setConfirming(false);
        router.refresh();
      } catch {
        toast.error("Couldn't delete that version");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-xl font-medium">Earlier versions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Only you see these. Everyone else hears the current version.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Earlier versions">
          {versions.map((v) => (
            <Button
              key={v.id}
              variant="outline"
              size="sm"
              aria-pressed={v.id === selectedId}
              onClick={() => select(v.id)}
              className={cn(
                "tabular-nums",
                v.id === selectedId && "border-primary bg-primary/10 text-foreground",
              )}
            >
              {versionLabel(v.created_at)}
            </Button>
          ))}
        </div>

        {selected && (
          <ScriptPlaybackProvider key={selected.id}>
            <div className="space-y-6">
              {selected.audio_url ? (
                <AudioPlayer
                  audioUrl={selected.audio_url}
                  title={title}
                  meditationId={meditationId}
                  canDownload
                  downloadHref={`/api/audio/${meditationId}/download?version=${selected.id}`}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  This version&apos;s audio couldn&apos;t be loaded.
                </p>
              )}
              <ScriptViewer script={selected.script} />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {confirming ? (
                  <>
                    <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => remove(selected.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                      {pending ? "Deleting..." : "Delete for good"}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" className="gap-2" onClick={() => setConfirming(true)}>
                    <Trash2 className="h-4 w-4" />
                    Delete this version
                  </Button>
                )}
              </div>
            </div>
          </ScriptPlaybackProvider>
        )}
      </CardContent>
    </Card>
  );
}
