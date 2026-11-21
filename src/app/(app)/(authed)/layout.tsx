import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/profile/viewer";

/**
 * Gate for routes that only make sense with an account: the library, the
 * creator, collections and the account page. Public pages (/discover, /meditation/[id]) sit
 * outside this group so signed-out visitors and crawlers can reach them --
 * RLS, not routing, decides which meditations they see.
 */
export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Shared through React's cache with the (app) layout and the page, so a
  // render asks Supabase Auth once.
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return children;
}
