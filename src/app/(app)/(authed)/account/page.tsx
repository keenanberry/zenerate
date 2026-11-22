import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, type Profile } from "@/lib/profile/profile";
import { ProfileForm } from "@/components/profile-form";
import { ThemeChoice } from "@/components/theme-choice";
import { SignOutButton } from "@/components/sign-out-button";
import { AccountBackLink } from "@/components/account-back-link";

export const metadata = {
  title: "Account | Zenerate",
};

/**
 * The signed-in user's account: their profile (edited through
 * PATCH /api/profile), the theme, and Sign out, which left the top bar for
 * here. Their meditations, favourites, bookmarks and collections are in the
 * Library; their draft chats are on Create.
 * The (authed) layout has already sent signed-out visitors to /login.
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The same read GET /api/profile makes, on the same RLS-scoped client, so
  // the form arrives filled instead of loading after the page.
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<Profile>();
  if (error) throw new Error("Could not load your profile");
  // A trigger on auth.users creates the row, so a missing one is a bug.
  if (!profile) throw new Error("Profile not found");

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-3">
        {/* A phone has no top bar and, installed, no browser back button;
            from md the top bar is the way out. */}
        <AccountBackLink className="md:hidden" />
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-medium tracking-tight">Account</h1>
          <p className="text-muted-foreground">Your profile and settings.</p>
        </div>
      </div>

      <AccountSection
        id="profile"
        title="Profile"
        description="How you appear beside your public meditations, if you choose to."
      >
        <div className="rounded-xl border bg-card px-6 py-6 sm:px-8 sm:py-8">
          <ProfileForm profile={profile} email={user.email ?? null} />
        </div>
      </AccountSection>

      <AccountSection
        id="appearance"
        title="Appearance"
        description="How Zenerate looks on this device."
      >
        <div className="rounded-xl border bg-card px-6 py-6 sm:px-8 sm:py-8">
          <ThemeChoice />
        </div>
      </AccountSection>

      <div className="border-t pt-10">
        <SignOutButton variant="outline" size="default" />
      </div>
    </div>
  );
}

/** One titled section of the page; each has an id a later card can link to. */
function AccountSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="space-y-6">
      <div className="space-y-2">
        <h2 id={`${id}-title`} className="font-serif text-xl font-medium tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
