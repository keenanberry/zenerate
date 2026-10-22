"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteMeditationVersion } from "@/lib/meditation/actions";

/**
 * Asked once a draft render finishes: the version it replaced is archived,
 * and the owner either keeps it (nothing happens) or replaces it (the
 * archived version and its audio are deleted).
 */
export function ReplaceOrKeep({ versionId }: { versionId: string }) {
  const [answer, setAnswer] = useState<"kept" | "replaced" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function replace() {
    setPending(true);
    setError(null);
    try {
      await deleteMeditationVersion(versionId);
      setAnswer("replaced");
    } catch {
      setError("The previous version couldn't be deleted. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (answer) {
    return (
      <p className="text-sm text-muted-foreground">
        {answer === "kept"
          ? "Kept. The previous version is under Earlier versions on the meditation page."
          : "Replaced. The previous version is deleted."}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm">Keep the previous version, or replace it?</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => setAnswer("kept")} disabled={pending}>
          Keep it
        </Button>
        <Button variant="outline" onClick={replace} disabled={pending}>
          {pending ? "Replacing..." : "Replace it"}
        </Button>
      </div>
    </div>
  );
}
