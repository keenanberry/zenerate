import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The eyebrow above a page title: a quiet link naming the surface the page
 * belongs to (a meditation's Library or Discover, a collection's Collections).
 *
 * It is wayfinding, not an action, so it is set in Label type in Dusk with no
 * box and no "Back": it names a place rather than promising history. On a
 * meditation that place is the list it was opened from, when known
 * (MeditationParentLink in back-origin.tsx). DESIGN.md, Navigation and the
 * rhythm table.
 */
export function ParentLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors"
    >
      <ArrowLeft className="size-3" aria-hidden="true" />
      {children}
    </Link>
  );
}
