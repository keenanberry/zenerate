"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

type ViewMode = "grid" | "list";

const ViewContext = createContext<{
  view: ViewMode;
  setView: (view: ViewMode) => void;
}>({ view: "list", setView: () => {} });

const CHANGE = "zenerate:view-change";
// Where a choice lives when storage throws (a private window, blocked site
// data), so the toggle still works for the visit.
const memory = new Map<string, ViewMode>();

function read(key: string): ViewMode | null {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "grid" || saved === "list") return saved;
  } catch {}
  return memory.get(key) ?? null;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The list/grid choice, remembered per browser under `storageKey`, one key
 * per page. The server renders the default, and the saved choice takes over
 * once hydrated.
 */
export function ViewProvider({
  defaultView = "list",
  storageKey,
  children,
}: {
  defaultView?: ViewMode;
  storageKey: string;
  children: ReactNode;
}) {
  const view = useSyncExternalStore(
    subscribe,
    () => read(storageKey) ?? defaultView,
    () => defaultView,
  );

  const setView = useCallback(
    (next: ViewMode) => {
      memory.set(storageKey, next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {}
      window.dispatchEvent(new Event(CHANGE));
    },
    [storageKey],
  );

  return (
    <ViewContext.Provider value={{ view, setView }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
