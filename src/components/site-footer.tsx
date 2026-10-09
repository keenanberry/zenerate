import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t py-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>zenerate — AI-powered meditation generation</span>
        <nav className="flex gap-4">
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
