import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

/**
 * Public shell for the Terms and Privacy pages. No typography plugin is
 * installed, so the article styles its own headings, lists and links here
 * rather than in every page.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            zenerate
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <article className="space-y-4 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_h1]:font-serif [&_h1]:text-3xl [&_h1]:font-medium [&_h1]:tracking-tight [&_h2]:pt-4 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-medium [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
