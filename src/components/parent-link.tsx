import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The eyebrow above a page title: a quiet link naming the surface the page
 * belongs to (a meditation's Library or Discover, a collection's Collections).
 *
 * It is wayfinding, not an action, so it is set in Label type in Dusk with no
 * box and no "Back": it names where the page lives rather than promising a
 * history it cannot honour. DESIGN.md, Navigation and the rhythm table.
 */
export function ParentLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
    >
      <ArrowLeft className="size-3" aria-hidden="true" />
      {children}
    </Link>
  );
}
