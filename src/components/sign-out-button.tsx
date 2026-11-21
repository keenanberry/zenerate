"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resetBookmarkOverrides } from "@/lib/meditation/bookmark-state";
import { Button } from "@/components/ui/button";

/**
 * Signs out, forgets this tab's bookmark toggles (they belong to the account
 * that made them), and goes home. The landing and legal top bars carry it as
 * an icon; Account carries it with its label.
 */
export function SignOutButton({
  children,
  variant = "ghost",
  size = "sm",
  className,
}: Pick<ComponentProps<typeof Button>, "variant" | "size" | "className" | "children">) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await createClient().auth.signOut();
    resetBookmarkOverrides();
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSignOut}
      disabled={pending}
      className={className}
    >
      {children ?? (
        <>
          <LogOut aria-hidden />
          Sign out
        </>
      )}
    </Button>
  );
}
