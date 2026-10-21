import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The callback signs the visitor in from the email's code; with no session, or a
  // link the callback could not exchange, there is nothing to reset.
  if (error || !user) {
    return (
      <AuthCard
        title="This link has expired"
        description="Reset links work once, for an hour, in the browser that asked for them"
      >
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description={`For ${user.email}`}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
