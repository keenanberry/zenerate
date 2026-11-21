import type { ReactNode } from "react";
import { ParentLink } from "@/components/parent-link";

/**
 * One of the Library's places (/library/favorites, /bookmarks, /meditations,
 * /collections): the eyebrow back to the Library, the title in Lora with an
 * optional toolbar at its right (the list/grid toggle), and the content 32px
 * below. `backLabel` names the page for a meditation opened from it, so that
 * meditation's eyebrow links back here (src/components/back-origin.tsx).
 */
export function LibrarySubpage({
  title,
  backLabel,
  toolbar,
  children,
}: {
  title: string;
  backLabel: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-back-label={backLabel}>
      <div className="space-y-3">
        <ParentLink href="/library">Library</ParentLink>
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 font-serif text-2xl font-medium tracking-tight">{title}</h1>
          {toolbar && <div className="shrink-0">{toolbar}</div>}
        </div>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

/** A place with nothing in it yet: one sentence, and a way to fill it. */
export function LibraryEmptyState({
  message,
  children,
}: {
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-16 text-center">
      <p className="max-w-[48ch] text-muted-foreground">{message}</p>
      {children}
    </div>
  );
}
