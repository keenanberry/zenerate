"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * The way to Account: a round chip with the person's initials (`initials` in
 * src/lib/navigation/app-tabs.ts). In the app-shell top bar from `md`, and in
 * the Library's header on a phone, as Apple Music puts it.
 */
export function AccountAvatarLink({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  const current = usePathname().startsWith("/account");

  return (
    <Link
      href="/account"
      aria-label="Account"
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium tracking-wide text-foreground outline-none hover:bg-card-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors",
        current && "border-primary",
        className,
      )}
    >
      <span aria-hidden>{initials}</span>
    </Link>
  );
}
