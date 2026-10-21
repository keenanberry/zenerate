"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordRedirectUrl } from "@/lib/auth/redirect";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // The result is deliberately ignored: any error ("no such user", "too soon")
    // would tell a stranger whether an account exists for this address.
    await supabase.auth
      .resetPasswordForEmail(email, {
        redirectTo: resetPasswordRedirectUrl(window.location.origin),
      })
      .catch(() => undefined);

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthCard
        title="Check your email"
        description="If an account exists for that email, a reset link has been sent."
      >
        <p className="text-center text-sm text-muted-foreground">
          The link works for an hour. Open it in this browser.
        </p>
        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new one"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}
