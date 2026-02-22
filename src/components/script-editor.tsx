"use client";

import { useState } from "react";
import { ScriptViewer } from "@/components/script-viewer";
import { Button } from "@/components/ui/button";
import { Pencil, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptEditorProps {
  script: string;
  onChange: (script: string) => void;
}

export function ScriptEditor({ script, onChange }: ScriptEditorProps) {
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-3">
      {/* Mobile tab toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 md:hidden">
        <Button
          type="button"
          variant={mobileTab === "edit" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 gap-2"
          onClick={() => setMobileTab("edit")}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant={mobileTab === "preview" ? "secondary" : "ghost"}
          size="sm"
          className="flex-1 gap-2"
          onClick={() => setMobileTab("preview")}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </Button>
      </div>

      {/* Desktop: side-by-side / Mobile: tabbed */}
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={cn(
            "space-y-2",
            mobileTab !== "edit" && "hidden md:block"
          )}
        >
          <label className="hidden text-xs font-medium text-muted-foreground md:block">
            Raw Script
          </label>
          <textarea
            value={script}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "min-h-[400px] w-full resize-y rounded-md border bg-background px-3 py-2",
              "font-mono text-sm leading-relaxed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "placeholder:text-muted-foreground"
            )}
            placeholder="Meditation script with markup..."
            spellCheck={false}
          />
        </div>

        <div
          className={cn(
            "space-y-2",
            mobileTab !== "preview" && "hidden md:block"
          )}
        >
          <label className="hidden text-xs font-medium text-muted-foreground md:block">
            Preview
          </label>
          <div className="min-h-[400px] rounded-md border bg-card p-4">
            <ScriptViewer script={script} />
          </div>
        </div>
      </div>
    </div>
  );
}
