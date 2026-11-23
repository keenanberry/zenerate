"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { iosBrowserName } from "@/lib/install/platform";
import { InstallInstructions, installTitle } from "./install-instructions";
import type { InstallState } from "./install-state";

/**
 * The install instructions as a bottom sheet on a phone and a dialog from
 * `md`, opened from the Library card and from Account's "Install the app".
 */
export function InstallSheet({
  open,
  onOpenChange,
  state,
  siteUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: Pick<InstallState, "platform" | "canPrompt" | "promptInstall">;
  siteUrl: string;
}) {
  const { platform, canPrompt, promptInstall } = state;
  const prompting = platform === "android" && canPrompt;
  // The platform is null on the server, so navigator is only read in a browser.
  const browser = platform === "ios-other" ? iosBrowserName(navigator.userAgent) : null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={installTitle(platform, canPrompt)}
      className="sm:max-w-lg"
      footer={
        prompting ? (
          <Button
            onClick={async () => {
              onOpenChange(false);
              await promptInstall();
            }}
          >
            <Download aria-hidden />
            Install
          </Button>
        ) : undefined
      }
    >
      <div className="pt-2 pb-2">
        <InstallInstructions
          platform={platform}
          browser={browser}
          canPrompt={canPrompt}
          siteUrl={siteUrl}
        />
      </div>
    </ResponsiveDialog>
  );
}
