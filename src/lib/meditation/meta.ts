import { TAG_LABELS, isTag } from "@/lib/meditation/tags";

interface MetaSource {
  tags?: string[] | null;
  settings?: { duration?: number } | null;
  created_at?: string;
}

/** "Today", "Yesterday", "3d ago" within a week, then "Oct 1". */
export function relativeDate(dateStr: string, now = new Date()) {
  const date = new Date(dateStr);
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The one quiet line under a meditation's title in a list (task 48): its
 * first known tag, its length and when it was made, e.g.
 * "Grounding · 10 min · Yesterday". Parts that are missing are left out.
 */
export function metaLine(m: MetaSource, { now }: { now?: Date } = {}) {
  const tag = (m.tags ?? []).find(isTag);
  const minutes = m.settings?.duration;

  return [
    tag && TAG_LABELS[tag],
    minutes && `${minutes} min`,
    m.created_at && relativeDate(m.created_at, now),
  ]
    .filter(Boolean)
    .join(" · ");
}
