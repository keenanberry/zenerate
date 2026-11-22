"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_FALLBACK_HREF,
  ACCOUNT_STATE_KEY,
  canGoBack,
  isAccountPending,
  readAccountReturn,
  writeAccountReturn,
} from "@/lib/navigation/account-return";
import { cn } from "@/lib/utils";

function session(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Account's way out on a phone, where the installed app has no browser back
 * button: the studio's chevron, back to the page the avatar was tapped on
 * (through history, so that page keeps its scroll), else the Library. It
 * names no place because Account is reached from every tab.
 */
export function AccountBackLink({ className }: { className?: string }) {
  const router = useRouter();

  // The first mount after an avatar click: tag this history entry, so the
  // link knows the entry before it is a page of this site.
  useEffect(() => {
    const storage = session();
    const record = readAccountReturn(storage);
    if (!isAccountPending(record, Date.now())) return;
    try {
      window.history.replaceState({ ...window.history.state, [ACCOUNT_STATE_KEY]: record.token }, "");
    } catch {}
    writeAccountReturn(storage, { token: record.token });
  }, []);

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    if (canGoBack(readAccountReturn(session()), window.history.state)) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      // The Button's colour fade is off under reduced motion.
      className={cn("-ml-2 h-10 w-10 shrink-0 text-muted-foreground motion-reduce:transition-none", className)}
    >
      <Link href={ACCOUNT_FALLBACK_HREF} onClick={onClick} aria-label="Back">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
    </Button>
  );
}
