import { safeNextPath } from "@/lib/auth/redirect";
import { loginErrorMessage } from "@/lib/auth/errors";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={safeNextPath(next ?? null, "/dashboard")}
      initialError={loginErrorMessage(error ?? null)}
    />
  );
}
