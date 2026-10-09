"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself.
 *
 * It *replaces* the root layout rather than rendering inside it, so nothing
 * from layout.tsx is available here -- not the font variables, and crucially
 * not ThemeProvider. Two consequences are handled below:
 *
 *   1. globals.css is imported directly, or there would be no design tokens
 *      at all and this would render as unstyled black-on-white.
 *   2. next-themes is not running to put `.dark` on <html>, so the same
 *      choice is re-applied inline before paint. Without it a dark-mode user
 *      gets flashed a white page at the worst possible moment. It is wrapped
 *      in try/catch because localStorage throws in some privacy modes, and a
 *      crashing error page is the one failure with nowhere left to fall back
 *      to.
 */
const restoreTheme = `try{var t=localStorage.getItem('theme');if(t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: restoreTheme }} />
      </head>
      <body className="antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            Zenerate is having a moment
          </h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Something failed while loading the app itself. Reloading usually
            sorts it out.
          </p>
          <button
            onClick={reset}
            className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reload
          </button>
          {error.digest && (
            <p className="mt-6 font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
