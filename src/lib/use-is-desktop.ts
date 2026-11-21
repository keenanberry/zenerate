"use client";

import { useSyncExternalStore } from "react";

/** The `md` breakpoint: below it the phone layout (bottom bar, sheets). */
const DESKTOP_QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the window is at least `md` wide, following it as it resizes.
 * The server, and the hydrating client, say desktop; a phone switches on the
 * render after. That is safe for the menus and dialogs that use it, because
 * their content mounts only when opened, after hydration: the first render
 * is the trigger alone.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
