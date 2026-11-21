"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Library, Plus, type LucideIcon } from "lucide-react";
import { APP_TABS, activeTab, showBottomBar, type AppTab } from "@/lib/navigation/app-tabs";
import { cn } from "@/lib/utils";

const ICONS: Record<AppTab, LucideIcon> = {
  library: Library,
  discover: Compass,
  create: Plus,
};

/**
 * The signed-in phone's navigation: Library, Discover and Create, one thumb
 * away from any page. Hidden from `md`, where the top bar carries the same
 * links, and in the studio, whose composer owns the bottom of the screen.
 * The session player (z-50) covers it while open.
 *
 * The shell pads itself by the bar's height (src/app/(app)/layout.tsx) so the
 * last row and the footer scroll clear of it. The safe-area term is 0 while
 * the root layout leaves `viewport-fit` alone; it is there in case it doesn't.
 */
export function BottomBar() {
  const pathname = usePathname();
  if (!showBottomBar(pathname)) return null;
  const active = activeTab(pathname);

  return (
    <nav
      aria-label="Primary"
      // Border-box: the Hairline and the inset are inside this height,
      // which is exactly the padding the shell leaves for it.
      className="fixed inset-x-0 bottom-0 z-40 h-[calc(4rem+env(safe-area-inset-bottom,0px))] border-t bg-sidebar/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex h-full max-w-md items-stretch px-2">
        {APP_TABS.map((tab) => {
          const Icon = ICONS[tab.id];
          const current = tab.id === active;
          return (
            <li key={tab.id} className="flex flex-1">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors",
                  current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className={cn("size-5", current && "text-primary")} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
