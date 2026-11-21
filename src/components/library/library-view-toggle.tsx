"use client";

import { useView } from "@/components/view-context";
import { ViewToggle } from "@/components/view-toggle";

/** The list/grid toggle for the nearest ViewProvider, for LibrarySubpage's toolbar. */
export function LibraryViewToggle() {
  const { view, setView } = useView();
  return <ViewToggle view={view} onViewChange={setView} />;
}
