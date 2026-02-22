"use client";

import type { ReactNode } from "react";
import { ViewProvider, useView } from "@/components/view-context";
import { ViewToggle } from "@/components/view-toggle";

function Inner({
  search,
  children,
}: {
  search: ReactNode;
  children: ReactNode;
}) {
  const { view, setView } = useView();

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        {search}
        <ViewToggle view={view} onViewChange={setView} />
      </div>
      {children}
    </>
  );
}

export function DiscoverViewWrapper({
  search,
  children,
}: {
  search: ReactNode;
  children: ReactNode;
}) {
  return (
    <ViewProvider>
      <Inner search={search}>{children}</Inner>
    </ViewProvider>
  );
}
