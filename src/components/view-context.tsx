"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ViewMode = "grid" | "list";

const ViewContext = createContext<{
  view: ViewMode;
  setView: (view: ViewMode) => void;
}>({ view: "list", setView: () => {} });

export function ViewProvider({
  defaultView = "list",
  children,
}: {
  defaultView?: ViewMode;
  children: ReactNode;
}) {
  const [view, setView] = useState<ViewMode>(defaultView);
  return (
    <ViewContext.Provider value={{ view, setView }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
