"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DISMISS_KEY, dismissalValue, isDismissed } from "@/lib/install/dismissal";
import { detectInstallPlatform, type InstallPlatform } from "@/lib/install/platform";

/**
 * The browser's side of the install prompt: which platform this is, whether
 * Chrome on Android has offered its own Install prompt, and whether the
 * Library card was dismissed on this device. Every value is `null` on the
 * server and on the hydrating render, so the card and the row decide what to
 * show only after mount, without a hydration mismatch or a flash.
 */

/** Chromium's `beforeinstallprompt` event; not in TypeScript's DOM types. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CHANGE = "zenerate:install-change";
const STANDALONE_QUERY = "(display-mode: standalone)";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisVisit = false;
/** "Not now" for this visit, for when localStorage refuses the write. */
let dismissedThisVisit: string | null = null;
let listening = false;

function notify() {
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Starts listening for the browser's install events. Chrome fires
 * `beforeinstallprompt` once per page load, often before the Library is open,
 * so the (app) shell calls this for a signed-in visitor on every page.
 */
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keep it for the card's Install button instead of Chrome's own banner.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedThisVisit = true;
    notify();
  });
}

// As early as the module loads in a browser, ahead of hydration.
listen();

/** Mounted once in the signed-in (app) shell; renders nothing. */
export function InstallPromptListener() {
  useEffect(listen, []);
  return null;
}

function subscribe(onChange: () => void) {
  listen();
  const standalone = window.matchMedia(STANDALONE_QUERY);
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  standalone.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
    standalone.removeEventListener("change", onChange);
  };
}

function readPlatform(): InstallPlatform {
  if (installedThisVisit) return "installed";
  const nav = navigator as Navigator & { standalone?: boolean };
  return detectInstallPlatform({
    userAgent: nav.userAgent,
    displayModeStandalone: window.matchMedia(STANDALONE_QUERY).matches,
    navigatorStandalone: nav.standalone === true,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

/** localStorage, or nothing where it throws (private modes, blocked storage). */
function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readDismissed(): boolean {
  let stored: string | null = null;
  try {
    stored = storage()?.getItem(DISMISS_KEY) ?? null;
  } catch {
    // Unreadable storage: only this visit's choice counts.
  }
  return isDismissed(stored ?? dismissedThisVisit, Date.now());
}

const serverNull = () => null;

export type InstallState = {
  /** `null` until mounted. */
  platform: InstallPlatform | null;
  /** Whether the browser's own Install prompt is ready to show. */
  canPrompt: boolean;
  /** Whether the Library card was dismissed in the last 30 days; `null` until mounted. */
  dismissed: boolean | null;
  dismiss: () => void;
  /** Shows the browser's Install prompt; resolves once the visitor has chosen. */
  promptInstall: () => Promise<void>;
};

export function useInstallState(): InstallState {
  const platform = useSyncExternalStore<InstallPlatform | null>(subscribe, readPlatform, serverNull);
  const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
  const dismissed = useSyncExternalStore<boolean | null>(subscribe, readDismissed, serverNull);

  const dismiss = useCallback(() => {
    dismissedThisVisit = dismissalValue(Date.now());
    try {
      storage()?.setItem(DISMISS_KEY, dismissedThisVisit);
    } catch {
      // Private mode: the card simply shows again next time.
    }
    notify();
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return;
    // An event prompts once; Chrome fires a fresh one if it can ask again.
    deferredPrompt = null;
    notify();
    await event.prompt();
    await event.userChoice;
  }, []);

  return {
    platform,
    canPrompt,
    dismissed,
    dismiss,
    promptInstall,
  };
}
