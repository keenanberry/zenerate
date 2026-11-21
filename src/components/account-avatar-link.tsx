"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * The way to Account: a round chip with the person's profile photo, or their
 * initials (`initials` in src/lib/navigation/app-tabs.ts) when they have none
 * or it fails to load. In the app-shell top bar from `md`, and in the
 * Library's header on a phone, as Apple Music puts it.
 */
export function AccountAvatarLink({
  initials,
  avatarUrl,
  className,
}: {
  initials: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const current = usePathname().startsWith("/account");

  return (
    <Link
      href="/account"
      aria-label="Account"
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium tracking-wide text-foreground outline-none hover:bg-card-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors md:size-9",
        current && "border-primary",
        className,
      )}
    >
      {avatarUrl ? (
        <Avatar aria-hidden className="size-full">
          <AvatarImage src={avatarUrl} alt="" className="object-cover" />
          <AvatarFallback className="bg-transparent text-xs text-foreground">{initials}</AvatarFallback>
        </Avatar>
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </Link>
  );
}
