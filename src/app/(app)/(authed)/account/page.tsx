import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS, type Profile } from "@/lib/profile/profile";
import { ProfileForm } from "@/components/profile-form";
import {
  AccountCreations,
  type AccountChat,
  type AccountMeditation,
} from "@/components/account-creations";
import { AccountBookmarks } from "@/components/account-bookmarks";
import { ACCOUNT_BOOKMARK_PAGE } from "@/lib/meditation/bookmark-state";
import { listBookmarks, type BookmarkPage } from "@/lib/meditation/bookmarks";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Account | Zenerate",
};

/**
 * The signed-in user's account: their profile (edited through
 * PATCH /api/profile), then the meditations they have saved for later
 * (card ZEN-8), then their own meditations and chats, each of which they can
 * delete here. Those come last and start closed (card ZEN-11): the studio is
 * where they are worked on.
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

  // Owner-only rows, filtered by owner too: the meditations select policy
  // also passes everyone's public ones. A chat with no title was never sent
  // to, so it has nothing to show (as on /create).
  // Bookmarks: the first page, as GET /api/bookmarks would give it; a failed
  // read says so in that section rather than failing the page.
  const [
    { data: meditations, error: meditationsError },
    { data: chats, error: chatsError },
    bookmarks,
  ] = await Promise.all([
      supabase
        .from("meditations")
        .select("id, title, is_public, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("chats")
        .select("id, title, updated_at")
        .eq("user_id", user.id)
        .not("title", "is", null)
        .order("updated_at", { ascending: false }),
      listBookmarks(supabase, user.id, { limit: ACCOUNT_BOOKMARK_PAGE }).catch(
        (err): BookmarkPage | null => {
          console.error("Could not load bookmarks:", err);
          return null;
        },
      ),
    ]);
  if (meditationsError || chatsError) throw new Error("Could not load your meditations and chats");

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
        id="bookmarks"
        title="Bookmarks"
        description="Meditations you've saved to come back to."
      >
        {bookmarks ? (
          <AccountBookmarks
            initial={bookmarks}
            empty={
              <AccountEmptyState message="Nothing saved yet. Tap the bookmark on a meditation in Discover to save it for later.">
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
        id="creations"
        title="My meditations & chats"
        description="What you've made in the studio, and the conversations behind it."
      >
        <AccountCreations
          meditations={(meditations ?? []) as AccountMeditation[]}
          chats={(chats ?? []) as AccountChat[]}
          empty={
            <AccountEmptyState message="Your meditations and studio conversations will be listed here.">
              <Button asChild variant="outline" size="sm">
                <Link href="/create">Make a meditation</Link>
              </Button>
            </AccountEmptyState>
          }
        />
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
