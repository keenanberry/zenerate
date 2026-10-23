"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div role="group" aria-label="View" className="flex items-center rounded-md border">
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 rounded-r-none", view === "grid" && "bg-muted")}
        aria-label="Grid view"
        aria-pressed={view === "grid"}
        onClick={() => onViewChange("grid")}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 rounded-l-none", view === "list" && "bg-muted")}
        aria-label="List view"
        aria-pressed={view === "list"}
        onClick={() => onViewChange("list")}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
