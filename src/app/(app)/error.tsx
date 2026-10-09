"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the authed route group.
 *
 * Its value is that it renders *inside* (app)/layout, so a failure in one
 * page keeps the nav and page chrome instead of replacing the whole shell
 * with the root boundary. The user stays oriented and one click from
 * anywhere else.
 *
 * (The ship task described this as stopping errors from "logging the user
 * out". An error boundary never signs anyone out -- the session cookie is
 * untouched. Preserving the chrome is the actual benefit.)
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error in (app):", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="font-serif text-xl font-medium tracking-tight">
        This page didn&apos;t load
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Something went wrong on our end. Your meditations are safe.
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
    </div>
  );
}
