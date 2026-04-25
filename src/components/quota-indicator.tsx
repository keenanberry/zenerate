import { createClient } from "@/lib/supabase/server";
import { getQuotaUsage } from "@/lib/audio/quota";
import { cn } from "@/lib/utils";

export async function QuotaIndicator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const usage = await getQuotaUsage(user.id, supabase);
  const exhausted = usage.remaining === 0;
  const resetDate = new Date(usage.resetsAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        exhausted
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-border bg-muted/30 text-muted-foreground",
      )}
      data-testid="quota-indicator"
    >
      <div>
        <span className="font-medium">{usage.used}</span> of{" "}
        <span className="font-medium">{usage.limit}</span> audio generations used
        this month <span className="opacity-70">· resets {resetDate}</span>
      </div>
      {exhausted && (
        <div className="mt-1 text-xs">
          You've used your audio generations this month. You can still generate scripts.
        </div>
      )}
    </div>
  );
}
