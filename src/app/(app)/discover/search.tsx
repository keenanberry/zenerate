"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetItem,
  BottomSheetSeparator,
  BottomSheetTrigger,
} from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DURATION_BUCKETS,
  TYPE_LABELS,
  discoverHref,
  followUrlQuery,
  type DiscoverFilters,
  type SearchField,
} from "@/lib/meditation/discover";
import { MEDITATION_TYPES, TAG_GROUPS, TAG_LABELS } from "@/lib/meditation/tags";
import { useIsDesktop } from "@/lib/use-is-desktop";
import { cn } from "@/lib/utils";

/** Radix Select has no empty value, so "any" stands for a cleared filter. */
const ANY = "any";

const GROUP_LABELS: Record<keyof typeof TAG_GROUPS, string> = {
  themes: "Themes",
  practices: "Practices",
  moments: "Moments",
};

/** How long typing pauses before the URL, and so the results, follow. */
const SEARCH_DEBOUNCE_MS = 300;

type FilterOption = { value: string; label: string };
/** A filter's options, in groups; a group with a label reads as a section. */
type FilterGroup = { label?: string; options: FilterOption[] };

function FilterSelect({
  label,
  value,
  onChange,
  groups,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  groups: FilterGroup[];
}) {
  const desktop = useIsDesktop();
  const any = `Any ${label.toLowerCase()}`;

  if (!desktop) {
    const current = groups.flatMap((g) => g.options).find((o) => o.value === value);
    return (
      <FilterSheet
        label={label}
        any={any}
        current={current}
        groups={groups}
        onChange={onChange}
      />
    );
  }

  return (
    <Select
      value={value ?? ANY}
      onValueChange={(v) => onChange(v === ANY ? undefined : v)}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("min-w-0 flex-1 sm:w-40 sm:flex-none", value && "border-ring")}
      >
        {/* Unset, the trigger names the filter; "Any length" truncates at 390px. */}
        <SelectValue>{value ? undefined : label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{any}</SelectItem>
        {groups.map((group, i) =>
          group.label ? (
            <SelectGroup key={group.label}>
              {/* A rule and a Label-type heading, so the groups read as groups. */}
              <SelectSeparator className="mt-1" />
              <SelectLabel>{group.label}</SelectLabel>
              {group.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            group.options.map((o) => (
              <SelectItem key={`${i}-${o.value}`} value={o.value}>
                {o.label}
              </SelectItem>
            ))
          ),
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * A filter on a phone: a button like the Select's trigger that opens a
 * bottom sheet of the options as large rows, a check on the current one.
 */
function FilterSheet({
  label,
  any,
  current,
  groups,
  onChange,
}: {
  label: string;
  any: string;
  current: FilterOption | undefined;
  groups: FilterGroup[];
  onChange: (value: string | undefined) => void;
}) {
  const option = (value: string | undefined, text: string) => {
    const selected = value === current?.value;
    return (
      <BottomSheetItem key={value ?? ANY} onSelect={() => onChange(value)}>
        <span aria-current={selected || undefined} className="min-w-0 flex-1 truncate">
          {text}
        </span>
        {selected && <Check className="text-primary" aria-hidden />}
      </BottomSheetItem>
    );
  };

  return (
    <BottomSheet>
      <BottomSheetTrigger asChild>
        <button
          type="button"
          aria-label={current ? `${label}: ${current.label}` : label}
          className={cn(
            "flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 motion-safe:transition-[color,box-shadow]",
            current ? "border-ring" : "text-muted-foreground",
          )}
        >
          {/* Unset, the trigger names the filter, as the Select's does. */}
          <span className="truncate">{current?.label ?? label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </BottomSheetTrigger>
      <BottomSheetContent title={label}>
        {option(undefined, any)}
        {groups.map((group, i) => (
          <div key={group.label ?? i}>
            {group.label && (
              <>
                <BottomSheetSeparator />
                <p className="pt-3 pb-1.5 text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
                  {group.label}
                </p>
              </>
            )}
            {group.options.map((o) => option(o.value, o.label))}
          </div>
        ))}
      </BottomSheetContent>
    </BottomSheet>
  );
}

/**
 * The search bar and its filters. All state lives in the URL, so results are
 * server-rendered and a search is a link. Filters apply at once; typing
 * applies after a short pause, with replace rather than push so the back
 * button skips the half-typed queries.
 */
export function DiscoverSearch({ filters }: { filters: DiscoverFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [field, setField] = useState<SearchField>({ text: filters.q ?? "", awaiting: null });
  const query = field.text;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read inside the debounced callback, so a filter chosen mid-typing is kept.
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // The URL can change from outside the field (a category card, "Clear
  // all", the back button). Follow it, but never with an older query that
  // lands while newer typing is on its way (followUrlQuery).
  const [urlQuery, setUrlQuery] = useState(filters.q);
  if (filters.q !== urlQuery) {
    setUrlQuery(filters.q);
    setField(followUrlQuery(field, filters.q));
  }

  function go(patch: Partial<Record<keyof DiscoverFilters, string | undefined>>, replace = false) {
    const href = discoverHref(filtersRef.current, patch);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  /** Send the typed query; the field waits for the URL to reach it. */
  function sendQuery(text: string, replace = true) {
    const q = text.trim();
    // Already the URL's query: no change will arrive to end the wait.
    const awaiting = q === (filtersRef.current.q ?? "") ? null : q;
    setField({ text, awaiting });
    go({ q: q || undefined }, replace);
  }

  function handleQuery(value: string) {
    // Typing starts a wait at once, so a query landing mid-word is not copied in.
    setField({ text: value, awaiting: value.trim() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => sendQuery(value), SEARCH_DEBOUNCE_MS);
  }

  function clearQuery() {
    if (timer.current) clearTimeout(timer.current);
    sendQuery("");
  }

  return (
    <form
      role="search"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        sendQuery(query, pathname === "/discover");
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          enterKeyHint="search"
          aria-label="Search meditations"
          placeholder="Search meditations…"
          value={query}
          onChange={(e) => handleQuery(e.target.value)}
          className="h-12 rounded-xl pr-11 pl-11 text-base md:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <FilterSelect
          label="Tag"
          value={filters.tag}
          onChange={(tag) => go({ tag })}
          groups={(Object.keys(TAG_GROUPS) as (keyof typeof TAG_GROUPS)[]).map((group) => ({
            label: GROUP_LABELS[group],
            options: TAG_GROUPS[group].map((tag) => ({ value: tag, label: TAG_LABELS[tag] })),
          }))}
        />
        <FilterSelect
          label="Type"
          value={filters.type}
          onChange={(type) => go({ type })}
          groups={[
            { options: MEDITATION_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] })) },
          ]}
        />
        <FilterSelect
          label="Length"
          value={filters.duration}
          onChange={(duration) => go({ duration })}
          groups={[
            {
              options: DURATION_BUCKETS.map((bucket) => ({
                value: bucket.slug,
                label: bucket.label,
              })),
            },
          ]}
        />
      </div>
    </form>
  );
}
