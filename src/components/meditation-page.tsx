"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScriptViewer } from "@/components/script-viewer";
import { useFavorite, type FavoriteState } from "@/components/favorite-button";
import { cn } from "@/lib/utils";

/**
 * State the meditation page shares between its header and the session view
 * (task 55): the favourite, so the heart by the title and the session's menu
 * agree, and whether the script is shown, so the session's "Show script" can
 * open it on the page.
 */
type MeditationPage = {
  favorite: FavoriteState;
  scriptOpen: boolean;
  setScriptOpen: (open: boolean) => void;
  /** Open the script and bring it into view. */
  revealScript: () => void;
  scriptRef: React.RefObject<HTMLDivElement | null>;
};

const MeditationPageContext = createContext<MeditationPage | null>(null);

export function MeditationPageProvider({
  meditationId,
  isFavorited,
  children,
}: {
  meditationId: string;
  isFavorited: boolean;
  children: React.ReactNode;
}) {
  const favorite = useFavorite(meditationId, isFavorited);
  const [scriptOpen, setScriptOpen] = useState(false);
  const scriptRef = useRef<HTMLDivElement>(null);

  const revealScript = useCallback(() => {
    setScriptOpen(true);
    // After the script has rendered, so the scroll lands on it.
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scriptRef.current?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
    });
  }, []);

  return (
    <MeditationPageContext.Provider
      value={{ favorite, scriptOpen, setScriptOpen, revealScript, scriptRef }}
    >
      {children}
    </MeditationPageContext.Provider>
  );
}

/** The page's shared state, or null outside a meditation page. */
export function useMeditationPage(): MeditationPage | null {
  return useContext(MeditationPageContext);
}

/**
 * The script, closed behind "Show script" (task 55). A meditation is
 * listened to, not read; the script is reviewed in the studio before a
 * render. Shown, it still follows the player.
 */
export function ScriptDisclosure({ script }: { script: string }) {
  const page = useMeditationPage();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = page?.scriptOpen ?? ownOpen;
  const setOpen = page?.setScriptOpen ?? setOwnOpen;

  return (
    <div ref={page?.scriptRef} className="scroll-mt-6 border-t">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? "meditation-script" : undefined}
        className="flex w-full items-center justify-between rounded-md py-4 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
      >
        {open ? "Hide script" : "Show script"}
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 motion-safe:transition-transform motion-safe:duration-300",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        // The gutter holds the bar that marks the passage being spoken.
        <div id="meditation-script" className="pt-2 pb-4 pl-3 sm:pl-4">
          <ScriptViewer script={script} />
        </div>
      )}
    </div>
  );
}
