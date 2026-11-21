import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, type Profile } from "@/lib/profile/profile";
import { ProfileForm } from "@/components/profile-form";
import { AccountBookmarks } from "@/components/account-bookmarks";
import { ACCOUNT_BOOKMARK_PAGE } from "@/lib/meditation/bookmark-state";
import { listBookmarks, type BookmarkPage } from "@/lib/meditation/bookmarks";
import { Button } from "@/components/ui/button";
import { ThemeChoice } from "@/components/theme-choice";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata = {
  title: "Account | Zenerate",
};

/**
 * The signed-in user's account: their profile (edited through
 * PATCH /api/profile), the meditations they have saved for later (card
 * ZEN-8; they move into the Library in the next step of the app shell),
 * the theme, and Sign out, which left the top bar for here. Their own
 * meditations are listed and deleted in the Library, their draft chats on
 * Create.
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

  // Bookmarks: the first page, as GET /api/bookmarks would give it; a failed
  // read says so in that section rather than failing the page.
  const bookmarks = await listBookmarks(supabase, user.id, {
    limit: ACCOUNT_BOOKMARK_PAGE,
  }).catch((err): BookmarkPage | null => {
    console.error("Could not load bookmarks:", err);
    return null;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-2">
        <h1 className="font-serif text-2xl font-medium tracking-tight">Account</h1>
        <p className="text-muted-foreground">Your profile and settings.</p>
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
        id="bookmarks"
        title="Bookmarks"
        description="Meditations you've saved to come back to."
      >
        {bookmarks ? (
          <AccountBookmarks
            initial={bookmarks}
            empty={
              <AccountEmptyState message="Nothing saved yet. Open a meditation and tap its bookmark to save it for later.">
                <Button asChild variant="outline" size="sm">
                  <Link href="/discover">Browse Discover</Link>
                </Button>
              </AccountEmptyState>
            }
          />
        ) : (
          <AccountEmptyState message="Your bookmarks couldn't be loaded. Try again in a moment." />
        )}
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
