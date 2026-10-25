"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { AuthCard } from "@/components/auth-card";
import { GoogleMark } from "@/components/google-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CODE_LENGTH = 6;
const GOOGLE_UNAVAILABLE =
  "Google sign-in isn't available right now. Continue with email instead.";

type Step = "start" | "code" | "password";
type Busy = "google" | "email" | "code" | "resend" | "password" | null;

/** Whether this Supabase project has the Google provider switched on. */
async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    });
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

/**
 * One page for signing in and signing up: Google and the emailed code create the
 * account if it does not exist. The password form is kept for accounts that have one.
 */
export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError: string | null;
}) {
  const [step, setStep] = useState<Step>("start");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [codeRejected, setCodeRejected] = useState(false);
  const verifying = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = createClient();

  function goTo(nextStep: Step) {
    setStep(nextStep);
    setCodeRejected(false);
    setError(null);
    setNotice(null);
    setCode("");
  }

  function signedIn() {
    router.replace(next);
    router.refresh();
  }

  async function continueWithGoogle() {
    setError(null);
    setBusy("google");
    const [{ data, error }, enabled] = await Promise.all([
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          skipBrowserRedirect: true,
        },
      }),
      googleEnabled(),
    ]);
    // Without the provider on, Supabase answers the redirect with a raw JSON error page,
    // so check first and say it in a sentence instead.
    if (error || !data.url || !enabled) {
      setError(GOOGLE_UNAVAILABLE);
      setBusy(null);
      return;
    }
    window.location.assign(data.url);
  }

  async function sendCode(kind: "email" | "resend") {
    setError(null);
    setCodeRejected(false);
    setNotice(null);
    setBusy(kind);
    // No emailRedirectTo: the email carries a code to type here, so nothing depends on
    // which browser opens a link (the installed iPhone app would lose the session).
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(null);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    if (kind === "resend") {
      setCode("");
      setNotice("A new code is on its way. Use the newest one.");
    } else {
      goTo("code");
    }
  }

  async function verifyCode(token: string) {
    if (verifying.current) return;
    verifying.current = true;
    setError(null);
    setCodeRejected(false);
    setNotice(null);
    setBusy("code");
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    verifying.current = false;
    if (error) {
      setBusy(null);
      setError(authErrorMessage(error));
      setCodeRejected(true);
      // Empty the field so the next try, typed or offered by iOS, starts clean.
      setCode("");
      codeInput.current?.focus();
      return;
    }
    signedIn();
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    // iOS fills all six digits at once from Mail, so a full code submits itself.
    if (digits.length === CODE_LENGTH) void verifyCode(digits);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("password");
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setBusy(null);
        setError(authErrorMessage(error));
        return;
      }
      // With email confirmation on, the account waits for the emailed code.
      if (!data.session) {
        setBusy(null);
        goTo("code");
        setNotice("Enter the code from the email to confirm your address.");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(null);
        setError(authErrorMessage(error));
        return;
      }
    }
    signedIn();
  }

  const messages = (
    <>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
    </>
  );

  if (step === "code") {
    return (
      <AuthCard title="Check your email" description={`Enter the 6-digit code sent to ${email}`}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode(code);
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              ref={codeInput}
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={CODE_LENGTH}
              placeholder="000000"
              autoFocus
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              aria-invalid={codeRejected || undefined}
              // The tracking trails the last digit too; the matching left padding recentres them.
              className="h-12 pl-[calc(0.75rem+0.4em)] text-center placeholder:text-muted-foreground/40 text-2xl tracking-[0.4em] tabular-nums md:text-2xl"
              required
            />
          </div>
          {messages}
          <Button
            type="submit"
            size="lg"
            className="mt-2 w-full"
            disabled={busy !== null || code.length !== CODE_LENGTH}
          >
            {busy === "code" && <Loader2 className="motion-safe:animate-spin" />}
            {busy === "code" ? "Signing in…" : "Continue"}
          </Button>
        </form>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <button
            type="button"
            onClick={() => void sendCode("resend")}
            disabled={busy !== null}
            className="text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {busy === "resend" ? "Sending…" : "Send a new code"}
          </button>
          <button
            type="button"
            onClick={() => goTo("start")}
            className="text-primary underline-offset-4 hover:underline"
          >
            Use a different email
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          The code works for an hour. It isn&rsquo;t there? Check your spam folder.
        </p>
      </AuthCard>
    );
  }

  if (step === "password") {
    return (
      <AuthCard
        title={isSignUp ? "Create an account" : "Sign in with a password"}
        description={
          isSignUp ? "Choose a password of 6 characters or more" : "For accounts that have one"
        }
      >
        <form onSubmit={handlePassword} className="space-y-5">
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
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <Label htmlFor="password">Password</Label>
              {!isSignUp && (
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {messages}
          <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy !== null}>
            {busy === "password" && <Loader2 className="motion-safe:animate-spin" />}
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>
        <div className="mt-6 space-y-3 text-center text-sm">
          <p>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
          <p>
            <button
              type="button"
              onClick={() => goTo("start")}
              className="text-primary underline-offset-4 hover:underline"
            >
              Other ways to sign in
            </button>
          </p>
        </div>
        <LegalLine />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Welcome" description="Sign in, or create a free account">
      <div className="space-y-6">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => void continueWithGoogle()}
          disabled={busy !== null}
        >
          {busy === "google" ? (
            <Loader2 className="motion-safe:animate-spin" />
          ) : (
            <GoogleMark className="size-[18px]" />
          )}
          Continue with Google
        </Button>
        <div className="flex items-center gap-4 text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode("email");
          }}
          className="space-y-5"
        >
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
          {messages}
          <Button type="submit" size="lg" className="w-full" disabled={busy !== null}>
            {busy === "email" && <Loader2 className="motion-safe:animate-spin" />}
            Continue with email
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            We&rsquo;ll email you a 6-digit code. No password needed.
          </p>
        </form>
      </div>
      <div className="mt-6 text-center text-sm">
        <button
          type="button"
          onClick={() => goTo("password")}
          className="text-primary underline-offset-4 hover:underline"
        >
          Use a password instead
        </button>
      </div>
      <LegalLine />
    </AuthCard>
  );
}

function LegalLine() {
  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      By continuing, you agree to the{" "}
      <Link href="/terms" className="underline underline-offset-4">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="underline underline-offset-4">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
