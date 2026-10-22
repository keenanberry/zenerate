import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { TAG_LABELS, isTag } from "@/lib/meditation/tags";
import { cn } from "@/lib/utils";

/*
 * Stand-ins for components two parallel tasks are building. Each takes the
 * props its real component is specced with, so the swap is an import change.
 *
 *   CoverSlot     -> MeditationCover from task 35 (src/components/meditation-cover.tsx)
 *   TagPillsSlot  -> TagPills from task 33
 */

/** PLACEHOLDER for task 35's `MeditationCover`: a plain square with the mark. */
export function CoverSlot({
  className,
}: {
  id: string;
  tags: string[];
  title: string;
  size: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex aspect-square w-full items-center justify-center rounded-xl border bg-secondary/40",
        className,
      )}
    >
      <BrandMark className="size-1/3 text-primary/40" />
    </div>
  );
}

/** PLACEHOLDER for task 33's `TagPills`: secondary badges in Label type. */
export function TagPillsSlot({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="font-medium tracking-wide">
          {isTag(tag) ? TAG_LABELS[tag] : tag}
        </Badge>
      ))}
    </div>
  );
}
