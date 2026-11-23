"use client";

import { useState } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InstallPlatform } from "@/lib/install/platform";
import { InstallSheet } from "./install-sheet";
import { useInstallState } from "./install-state";

/**
 * The quiet card at the top of the Library that tells people the installed
 * app is the better way in. The server renders it, from the user agent and
 * the dismissal cookie, so it is in the first paint and nothing below it
 * moves. It is hidden in the installed app by CSS (`standalone:hidden`)
 * before paint, and removed there once the client knows; and it is left out
 * for 30 days after "Not now" on this device. Account's "Install the app"
 * opens the same sheet, so dismissing this is never a dead end.
 */
export function InstallCard({
  siteUrl,
  initialPlatform,
  initialDismissed,
}: {
  siteUrl: string;
  initialPlatform: InstallPlatform;
  initialDismissed: boolean;
}) {
  const state = useInstallState({ initialPlatform, initialDismissed });
  const [open, setOpen] = useState(false);

  return (
    <>
      <InstallCardView
        platform={state.platform}
        dismissed={state.dismissed}
        canPrompt={state.canPrompt}
        onShow={() => setOpen(true)}
        onInstall={state.promptInstall}
        onDismiss={state.dismiss}
      />
      <InstallSheet open={open} onOpenChange={setOpen} state={state} siteUrl={siteUrl} />
    </>
  );
}

export function InstallCardView({
  platform,
  dismissed,
  canPrompt,
  onShow,
  onInstall,
  onDismiss,
}: {
  platform: InstallPlatform | null;
  dismissed: boolean;
  canPrompt: boolean;
  onShow?: () => void;
  onInstall?: () => void;
  onDismiss?: () => void;
}) {
  if (platform === null || platform === "installed" || dismissed) return null;

  const desktop = platform === "desktop";
  const prompting = platform === "android" && canPrompt;

  return (
    <section
      aria-labelledby="install-card-title"
      className="flex flex-col gap-5 rounded-xl border bg-card px-6 py-6 sm:flex-row sm:items-center sm:gap-6 sm:px-8 standalone:hidden"
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {/* The icon people will find on their home screen. */}
        <Image
          src="/icon-192.png"
          alt=""
          width={48}
          height={48}
          // 6KB already, and the same file the home screen gets.
          unoptimized
          className="size-12 shrink-0 rounded-[0.7rem] border"
        />
        <div className="min-w-0 space-y-1">
          <h2 id="install-card-title" className="text-base font-medium">
            {desktop ? "Zenerate is best on your phone" : "Get the Zenerate app"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {desktop
              ? "Add it to your home screen there for lock-screen controls and full-screen sessions."
              : "Lock-screen controls and full-screen sessions, one tap from your home screen."}
          </p>
        </div>
      </div>
      {/* Install replaces Show me how in the same 36px slot when Chrome offers
          its prompt, so the card's height does not change. */}
      <div className="flex shrink-0 items-center gap-2 sm:flex-row-reverse">
        {prompting ? (
          <Button onClick={onInstall} className="flex-1 sm:flex-none">
            <Download aria-hidden />
            Install
          </Button>
        ) : (
          <Button onClick={onShow} className="flex-1 sm:flex-none">
            {desktop ? "Open on your phone" : "Show me how"}
          </Button>
        )}
        <Button variant="ghost" onClick={onDismiss} className="flex-1 sm:flex-none">
          Not now
        </Button>
      </div>
    </section>
  );
}
