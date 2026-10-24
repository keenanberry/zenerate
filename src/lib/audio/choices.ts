/**
 * Where the audio card's preselected voice or bed came from, so the card can
 * say why it chose it. Pure, so the precedence is tested on its own.
 */
export type ChoiceOrigin = "picked" | "suggested" | "last" | "default";

/**
 * The person's pick, else the agent's suggestion for this render, else the
 * choice this meditation was last rendered with, else the one from their most
 * recent completed meditation, else the default. The last two are both "the
 * same as last time".
 */
export function resolveChoice<T>({
  picked,
  suggested,
  saved,
  lastUsed,
  fallback,
}: {
  picked?: T | null;
  suggested?: T | null;
  saved?: T | null;
  lastUsed?: T | null;
  fallback: T;
}): { value: T; origin: ChoiceOrigin } {
  if (picked != null) return { value: picked, origin: "picked" };
  if (suggested != null) return { value: suggested, origin: "suggested" };
  if (saved != null) return { value: saved, origin: "last" };
  if (lastUsed != null) return { value: lastUsed, origin: "last" };
  return { value: fallback, origin: "default" };
}

/** The line under a preselected choice, or null when there is nothing to say. */
export function choiceNote(origin: ChoiceOrigin): string | null {
  if (origin === "suggested") return "Suggested for this one";
  if (origin === "last") return "Same as last time";
  return null;
}
