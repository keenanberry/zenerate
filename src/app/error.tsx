"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Catches anything thrown below the root layout that
 * no nearer boundary handled.
 *
 * `error.message` is deliberately not rendered: Next.js redacts it in
 * production anyway (the client receives a generic string plus `digest`),
 * so showing it would print reassuring detail in development and a useless
 * opaque string to real users. The digest is what correlates a user report
 * with a server log, so that is what we surface.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Minimum viable logging. Post-ship error-tracking.md replaces this.
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="font-serif text-2xl font-medium tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        That&apos;s on us, not you. Try again — and if it keeps happening, come
        back in a few minutes.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to library</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
