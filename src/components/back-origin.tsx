"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ParentLink } from "@/components/parent-link";
import {
  backTarget,
  isPending,
  originForClick,
  parseBackOrigin,
  readRaw,
  writeOrigin,
} from "@/lib/navigation/back-origin";

const CHANGE = "zenerate:back-origin-change";
// The history.state key marking an entry pushed by a recorded click, so the
// entry before it is the recorded page.
const STATE_KEY = "zenerateBackToken";

function session(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  return () => window.removeEventListener(CHANGE, onChange);
}

function newToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Records where a meditation was opened from, for every meditation link on
 * every page, in one place. A list page names itself by putting
 * `data-back-label` on an ancestor of its links (Discover, Library, a
 * collection's name); a meditation opened anywhere else clears the record.
 * Mounted once, in the root layout.
 */
export function BackOriginRecorder() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const origin = originForClick({
        linkHref: url.pathname + url.search,
        from: window.location.pathname + window.location.search,
        label: link.closest("[data-back-label]")?.getAttribute("data-back-label") ?? null,
        plain:
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          (!link.target || link.target === "_self"),
        now: Date.now(),
        token: newToken(),
      });
      if (origin === undefined) return;
      writeOrigin(session(), origin);
      window.dispatchEvent(new Event(CHANGE));
    }
    // Capture, so the record exists before next/link starts the navigation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

/**
 * The meditation page's parent link: back to the list it was opened from, or
 * the owner/Discover rule when there is no record (a shared link, a new tab,
 * the installed app). The server renders the rule; the record takes over once
 * hydrated.
 */
export function MeditationParentLink({
  meditationId,
  isOwner,
}: {
  meditationId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(session()),
    () => null,
  );
  const origin = useMemo(() => parseBackOrigin(raw, meditationId), [raw, meditationId]);
  const target = backTarget(origin, isOwner);
  // The token of the record whose page is the entry before this one, as this
  // mount knows it. The history tag alone is not enough: Next rewrites
  // history.state without custom keys on router.refresh() and server actions,
  // which favouriting and rating both trigger.
  const tagged = useRef<string | null>(null);

  // The first mount after a recorded click: tag this history entry, so a later
  // return to it (forward, or a reload) still knows the entry before it is the
  // recorded page.
  useEffect(() => {
    if (!origin) return;
    if (isPending(origin, Date.now())) {
      try {
        window.history.replaceState({ ...window.history.state, [STATE_KEY]: origin.token }, "");
      } catch {}
      tagged.current = origin.token;
      writeOrigin(session(), { ...origin, pendingAt: undefined });
      window.dispatchEvent(new Event(CHANGE));
      return;
    }
    if (window.history.state?.[STATE_KEY] === origin.token) tagged.current = origin.token;
  }, [origin]);

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    // Going back, rather than forward to the same URL, restores the list's
    // scroll position.
    if (
      origin &&
      (tagged.current === origin.token || window.history.state?.[STATE_KEY] === origin.token)
    ) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <ParentLink href={target.href} onClick={onClick}>
      {target.label}
    </ParentLink>
  );
}
