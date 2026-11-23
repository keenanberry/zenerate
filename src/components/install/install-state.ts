"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  INSTALL_CHANGE,
  INSTALLED_KEY,
  PROMPT_KEY,
  STANDALONE_ATTR,
} from "@/lib/install/capture-script";
import { DISMISS_COOKIE, dismissalCookie, isDismissed, readCookie } from "@/lib/install/dismissal";
import { detectInstallPlatform, type InstallPlatform } from "@/lib/install/platform";

/**
 * The browser's side of the install prompt: which platform this is, whether
 * Chrome on Android has offered its own Install prompt, and whether the
 * Library card was dismissed on this device.
 *
 * The server decides first, from the user agent and the dismissal cookie, so
 * the card is in the first paint; those values are the server snapshots here,
 * and the hydrating render matches them. After hydration the client refines
 * them: an iPad that reported a Mac becomes iOS, and the installed app becomes
 * "installed" (the card is already hidden there by `standalone:hidden`, keyed
 * on the head script's `data-standalone` marker, so removing it moves nothing).
 */

/** Chromium's `beforeinstallprompt` event; not in TypeScript's DOM types. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallWindow = Window & {
  [PROMPT_KEY]?: BeforeInstallPromptEvent | null;
  [INSTALLED_KEY]?: boolean;
};

const STANDALONE_QUERY = "(display-mode: standalone)";

/** "Not now" for this visit, for when the cookie cannot be written. */
let dismissedThisVisit = false;

function win(): InstallWindow {
  return window as InstallWindow;
}

function notify() {
  window.dispatchEvent(new Event(INSTALL_CHANGE));
}

function subscribe(onChange: () => void) {
  const standalone = window.matchMedia(STANDALONE_QUERY);
  window.addEventListener(INSTALL_CHANGE, onChange);
  standalone.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(INSTALL_CHANGE, onChange);
    standalone.removeEventListener("change", onChange);
  };
}

function readPlatform(): InstallPlatform {
  if (win()[INSTALLED_KEY]) return "installed";
  const nav = navigator as Navigator & { standalone?: boolean };
  return detectInstallPlatform({
    userAgent: nav.userAgent,
    // The head script's marker covers iOS home-screen apps that report no
    // display mode, or fullscreen.
    displayModeStandalone:
      document.documentElement.hasAttribute(STANDALONE_ATTR) ||
      window.matchMedia(STANDALONE_QUERY).matches,
    navigatorStandalone: nav.standalone === true,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

function readDismissed(): boolean {
  if (dismissedThisVisit) return true;
  try {
    return isDismissed(readCookie(document.cookie, DISMISS_COOKIE), Date.now());
  } catch {
    return false;
  }
}

function readCanPrompt(): boolean {
  return Boolean(win()[PROMPT_KEY]);
}

export type InstallState = {
  /** `null` only where the server did not decide (the Account row). */
  platform: InstallPlatform | null;
  /** Whether the browser's own Install prompt is ready to show. */
  canPrompt: boolean;
  /** Whether the Library card was dismissed in the last 30 days. */
  dismissed: boolean;
  dismiss: () => void;
  /** Shows the browser's Install prompt; resolves once the visitor has chosen. */
  promptInstall: () => Promise<void>;
};

export function useInstallState({
  initialPlatform = null,
  initialDismissed = false,
}: {
  /** The server's reading of the user agent. */
  initialPlatform?: InstallPlatform | null;
  /** The server's reading of the dismissal cookie. */
  initialDismissed?: boolean;
} = {}): InstallState {
  const platform = useSyncExternalStore<InstallPlatform | null>(
    subscribe,
    readPlatform,
    () => initialPlatform,
  );
  const canPrompt = useSyncExternalStore(subscribe, readCanPrompt, () => false);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => initialDismissed);

  const dismiss = useCallback(() => {
    dismissedThisVisit = true;
    try {
      document.cookie = dismissalCookie(Date.now(), location.protocol === "https:");
    } catch {
      // Cookies blocked: the card shows again next visit.
    }
    notify();
  }, []);

  const promptInstall = useCallback(async () => {
    const event = win()[PROMPT_KEY];
    if (!event) return;
    // An event prompts once; Chrome fires a fresh one if it can ask again.
    win()[PROMPT_KEY] = null;
    notify();
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // Already used, or the browser refused (InvalidStateError): the card
      // falls back to the menu steps, which still work.
    }
  }, []);

  return { platform, canPrompt, dismissed, dismiss, promptInstall };
}
