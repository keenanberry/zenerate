"use client";

import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_CHARS } from "@/lib/ai/quota";
import { createChat } from "@/lib/chat/actions";
import { firstMessageKey } from "./studio-context";

/**
 * The studio's front door: one input. Sending creates the chat and moves to
 * it, and the chat page sends the request, so the stream is watched where
 * it is shown.
 */
export function NewChatForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const request = text.trim();
    if (!request || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await createChat();
        sessionStorage.setItem(firstMessageKey(id), request);
        router.push(`/create/${id}`);
      } catch {
        setError("That didn't go through. Try again in a moment.");
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="relative">
        <label htmlFor="studio-request" className="sr-only">
          Describe the meditation you want
        </label>
        <Textarea
          id="studio-request"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_MESSAGE_CHARS}
          autoFocus
          placeholder="Ten minutes to unwind after a rough day"
          className="min-h-32 resize-none px-4 py-3.5 pr-16 text-base md:text-base"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || pending}
          className="absolute right-3 bottom-3"
          aria-label="Start"
        >
          {pending ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : <ArrowUp aria-hidden />}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
