"use client";

import { useState } from "react";
import { ChevronRight, Smartphone } from "lucide-react";
import { InstallSheet } from "./install-sheet";
import { useInstallState } from "./install-state";

/**
 * Account's permanent "Install the app" row. It opens the same sheet as the
 * Library card and is never dismissed, so "Not now" there is not a dead end.
 * In the installed app it says so instead.
 */
export function InstallRow({ siteUrl }: { siteUrl: string }) {
  const state = useInstallState();
  const [open, setOpen] = useState(false);
  const installed = state.platform === "installed";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-13 w-full items-center gap-4 rounded-xl border bg-card px-6 py-3 text-left outline-none hover:bg-card-hover focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-8 motion-safe:transition-colors"
      >
        <Smartphone aria-hidden className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-base">Install the app</span>
          <span className="block text-sm text-muted-foreground">
            {installed ? "Installed on this device" : "Add Zenerate to your home screen"}
          </span>
        </span>
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground motion-safe:transition-colors"
        />
      </button>
      <InstallSheet open={open} onOpenChange={setOpen} state={state} siteUrl={siteUrl} />
    </>
  );
}
