"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
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

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  children: React.ReactNode;
}) {
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
        <SelectItem value={ANY}>{`Any ${label.toLowerCase()}`}</SelectItem>
        {children}
      </SelectContent>
    </Select>
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
        <FilterSelect label="Tag" value={filters.tag} onChange={(tag) => go({ tag })}>
          {(Object.keys(TAG_GROUPS) as (keyof typeof TAG_GROUPS)[]).map((group) => (
            <SelectGroup key={group}>
              {/* A rule and a Label-type heading, so the groups read as groups. */}
              <SelectSeparator className="mt-1" />
              <SelectLabel>{GROUP_LABELS[group]}</SelectLabel>
              {TAG_GROUPS[group].map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {TAG_LABELS[tag]}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </FilterSelect>
        <FilterSelect label="Type" value={filters.type} onChange={(type) => go({ type })}>
          {MEDITATION_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Length"
          value={filters.duration}
          onChange={(duration) => go({ duration })}
        >
          {DURATION_BUCKETS.map((bucket) => (
            <SelectItem key={bucket.slug} value={bucket.slug}>
              {bucket.label}
            </SelectItem>
          ))}
        </FilterSelect>
      </div>
    </form>
  );
}
