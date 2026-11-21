"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Compass, Library, Plus, LogIn, LogOut, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountAvatarLink } from "@/components/account-avatar-link";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";
import { activeTab, type AppTab } from "@/lib/navigation/app-tabs";

const navItems: { tab: AppTab; href: string; label: string; icon: typeof Library; authed: boolean }[] = [
  { tab: "library", href: "/library", label: "Library", icon: Library, authed: true },
  { tab: "create", href: "/create", label: "Create", icon: Plus, authed: true },
  { tab: "discover", href: "/discover", label: "Discover", icon: Compass, authed: false },
];

/**
 * The top bar. `"site"` (the landing page and the legal layout) is the full
 * bar at every width: section links, theme toggle, account and sign in/out.
 * `"app"` (the in-app shell) is that bar for a signed-out visitor; signed in,
 * it is the wordmark alone below `md`, where the bottom bar carries the
 * sections, and from `md` the labelled sections with an avatar to Account,
 * which now holds the theme and Sign out.
 */
export function Nav({
  isSignedIn,
  variant = "site",
  avatar,
}: {
  isSignedIn: boolean;
  variant?: "site" | "app";
  avatar?: { initials: string } | null;
}) {
  const pathname = usePathname();
  const appShell = variant === "app" && isSignedIn;
  const visibleItems = navItems.filter((item) => isSignedIn || !item.authed);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8">
          <Link
            href={isSignedIn ? "/library" : "/"}
            className="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            {/* Decorative: the wordmark beside it is the link's name. Bold tier at
                22px, as the favicon is. */}
            <BrandMark bold className="size-5.5 shrink-0 text-primary" />
            zenerate
          </Link>
          <nav
            aria-label="Primary"
            className={cn("items-center gap-1 sm:gap-2", appShell ? "hidden md:flex" : "flex")}
          >
            {visibleItems.map((item) => {
              // In the app, the same rule as the bottom bar: a collection is
              // part of the Library.
              const current = appShell
                ? activeTab(pathname) === item.tab
                : pathname.startsWith(item.href);
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={current ? "secondary" : "ghost"}
                  size="sm"
                  className={cn("gap-2", current && "font-medium")}
                >
                  <Link href={item.href} aria-current={current ? "page" : undefined}>
                    <item.icon className="h-4 w-4" aria-hidden />
                    {/* Icons only below sm; the label stays for screen readers.
                        The app shell shows this row from md only, labelled. */}
                    <span className={appShell ? undefined : "sr-only sm:not-sr-only"}>
                      {item.label}
                    </span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
        {appShell ? (
          avatar && <AccountAvatarLink initials={avatar.initials} className="hidden md:flex" />
        ) : (
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            {isSignedIn && (
              <Button
                asChild
                variant={pathname.startsWith("/account") ? "secondary" : "ghost"}
                size="icon"
                className="size-8"
              >
                <Link
                  href="/account"
                  aria-label="Account"
                  aria-current={pathname.startsWith("/account") ? "page" : undefined}
                >
                  <UserRound className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            )}
            {isSignedIn ? (
              <SignOutButton className="gap-2">
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Sign out</span>
              </SignOutButton>
            ) : (
              <Button asChild variant="ghost" size="sm" className="gap-2">
                <Link href="/login">
                  <LogIn className="h-4 w-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only">Sign in</span>
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
