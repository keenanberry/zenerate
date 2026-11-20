import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, type Profile } from "@/lib/profile/profile";
import { ProfileForm } from "@/components/profile-form";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Account | Zenerate",
};

/**
 * The signed-in user's account: their profile (edited through
 * PATCH /api/profile), then their own meditations and chats, then their
 * bookmarks. The last two are placeholders that later cards fill in.
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
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Account</h1>
        <p className="text-muted-foreground">Your profile and the things you&apos;ve made and kept.</p>
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
        id="creations"
        title="My meditations & chats"
        description="What you've made in the studio, and the conversations behind it."
      >
        <AccountEmptyState message="Your meditations and studio conversations will be listed here.">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Open your Library</Link>
          </Button>
        </AccountEmptyState>
      </AccountSection>

      <AccountSection
        id="bookmarks"
        title="Bookmarks"
        description="Meditations you've saved to come back to."
      >
        <AccountEmptyState message="Meditations you bookmark will be listed here.">
          <Button asChild variant="outline" size="sm">
            <Link href="/discover">Browse Discover</Link>
          </Button>
        </AccountEmptyState>
      </AccountSection>
    </div>
  );
}

function AccountEmptyState({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border px-6 py-16 text-center">
      <p className="text-muted-foreground">{message}</p>
      {children}
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
