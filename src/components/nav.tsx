"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Compass, LayoutDashboard, Plus, LogIn, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Library", icon: LayoutDashboard, authed: true },
  { href: "/create", label: "Create", icon: Plus, authed: true },
  { href: "/discover", label: "Discover", icon: Compass, authed: false },
];

export function Nav({ isSignedIn }: { isSignedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const visibleItems = navItems.filter((item) => isSignedIn || !item.authed);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8">
          <Link
            href={isSignedIn ? "/dashboard" : "/"}
            className="flex items-center gap-2 text-lg font-bold tracking-tight"
          >
            {/* Decorative: the wordmark beside it is the link's name. Bold tier at
                22px, as the favicon is. */}
            <BrandMark bold className="size-5.5 shrink-0 text-primary" />
            zenerate
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {visibleItems.map((item) => (
              <Button
                key={item.href}
                asChild
                variant={pathname.startsWith(item.href) ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2",
                  pathname.startsWith(item.href) && "font-medium"
                )}
              >
                <Link
                  href={item.href}
                  aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                  {/* Icons only below sm; the label stays for screen readers. */}
                  <span className="sr-only sm:not-sr-only">{item.label}</span>
                </Link>
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isSignedIn ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link href="/login">
                <LogIn className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Sign in</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
