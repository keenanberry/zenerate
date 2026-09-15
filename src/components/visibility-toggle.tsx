"use client";

import { useState, useTransition } from "react";
import { Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateMeditation } from "@/lib/meditation/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VisibilityToggleProps {
  meditationId: string;
  isPublic: boolean;
}

export function VisibilityToggle({
  meditationId,
  isPublic: initialPublic,
}: VisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const newValue = !isPublic;
    setIsPublic(newValue);
    startTransition(async () => {
      try {
        await updateMeditation(meditationId, { is_public: newValue });
      } catch {
        setIsPublic(isPublic);
        toast.error("Couldn't update visibility");
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      className="gap-2"
    >
      {isPublic ? (
        <>
          <Globe className="h-3.5 w-3.5" />
          Public
        </>
      ) : (
        <>
          <Lock className="h-3.5 w-3.5" />
          Private
        </>
      )}
    </Button>
  );
}
