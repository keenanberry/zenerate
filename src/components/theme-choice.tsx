"use client";

import { useId, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const CHOICES = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

const noop = () => () => {};

/**
 * Account's Appearance: follow the device, or keep light or dark. A labelled
 * radio group rather than the old top bar's icon toggle, which could only
 * flip between light and dark and so lost "follow the device" once used.
 *
 * The stored choice is known only in the browser, so the server render (and
 * the first client render) checks nothing.
 */
export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const selected = mounted ? (theme ?? "system") : null;
  const id = useId();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="space-y-1">
        <p id={`${id}-label`} className="text-sm font-medium">
          Theme
        </p>
        <p id={`${id}-description`} className="text-sm text-muted-foreground">
          Follow your device, or keep one.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        className="inline-flex gap-1 rounded-lg border p-1"
      >
        {CHOICES.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "relative flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 motion-safe:transition-colors sm:h-9",
              "has-[:checked]:bg-secondary has-[:checked]:text-secondary-foreground",
            )}
          >
            <input
              type="radio"
              name={`${id}-theme`}
              value={value}
              checked={selected === value}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon aria-hidden className="size-4" />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
