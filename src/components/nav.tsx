"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Compass, LayoutDashboard, Plus, LogIn, LogOut } from "lucide-react";
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
            className="text-lg font-bold tracking-tight"
          >
            zenerate
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {visibleItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname.startsWith(item.href) ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-2",
                    pathname.startsWith(item.href) && "font-medium"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {isSignedIn ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Sign in</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
