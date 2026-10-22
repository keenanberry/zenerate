import { Badge } from "@/components/ui/badge";
import { TAG_LABELS, isTag } from "@/lib/meditation/tags";
import { cn } from "@/lib/utils";

interface TagPillsProps {
  tags: string[];
  size?: "sm" | "md";
  className?: string;
}

/**
 * A meditation's tags as pills in Label type on the Badge base. A slug that is
 * no longer in the vocabulary is skipped rather than shown raw.
 */
export function TagPills({ tags, size = "md", className }: TagPillsProps) {
  const known = tags.filter(isTag);
  if (known.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap", size === "sm" ? "gap-1.5" : "gap-2", className)}>
      {known.map((tag) => (
        <li key={tag} className="flex">
          <TagPill tag={tag} size={size} />
        </li>
      ))}
    </ul>
  );
}

export function TagPill({
  tag,
  size = "md",
  className,
  children,
}: {
  tag: string;
  size?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs leading-none font-medium tracking-[0.06em]",
        size === "md" ? "px-2.5 py-1" : "px-2 py-0.5",
        className,
      )}
    >
      {isTag(tag) ? TAG_LABELS[tag] : tag}
      {children}
    </Badge>
  );
}
