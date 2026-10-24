"use client";

import type { ReactNode } from "react";
import { ViewProvider, useView } from "@/components/view-context";
import { ViewToggle } from "@/components/view-toggle";

function Inner({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  const { view, setView } = useView();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{summary}</p>
        <ViewToggle view={view} onViewChange={setView} />
      </div>
      {children}
    </div>
  );
}

export function DiscoverViewWrapper({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <ViewProvider storageKey="zenerate:view:discover">
      <Inner summary={summary}>{children}</Inner>
    </ViewProvider>
  );
}
