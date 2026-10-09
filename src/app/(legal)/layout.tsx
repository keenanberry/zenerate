import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";

/**
 * Public shell for the Terms and Privacy pages. No typography plugin is
 * installed, so the article styles its own headings, lists and links here
 * rather than in every page.
 */
export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Nav isSignedIn={!!user} />
      {/* Prose: Body type at about 60ch (DESIGN.md, The Measure Rule). */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <article className="max-w-[60ch] space-y-5 text-base leading-7 [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h1]:pb-1 [&_h1]:font-serif [&_h1]:text-3xl [&_h1]:font-medium [&_h1]:tracking-tight [&_h2]:pt-6 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-medium [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
