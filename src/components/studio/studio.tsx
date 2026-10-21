"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { StudioUIMessage } from "@/lib/chat/tools";
import { Chat } from "./chat";
import { collectDrafts, describeChatError, latestDetails } from "./drafts";
import { ScriptCanvas } from "./script-canvas";
import { firstMessageKey, StudioProvider, type StudioContextValue } from "./studio-context";

/**
 * Resend on its own only once the owner has answered the audio card. The
 * stock predicate would also resend after a turn that ended on a server
 * tool (the step limit), which starts a turn nobody asked for.
 */
function answeredAudioCard({ messages }: { messages: StudioUIMessage[] }): boolean {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return false;
  const lastStep = last.parts.slice(last.parts.findLastIndex((p) => p.type === "step-start") + 1);
  return (
    lastStep.some(
      (p) => p.type === "tool-offerAudio" && (p.state === "output-available" || p.state === "output-error"),
    ) && lastAssistantMessageIsCompleteWithToolCalls({ messages })
  );
}

interface StudioProps {
  chatId: string;
  initialMessages: StudioUIMessage[];
  initialMeditationId: string | null;
}

export function Studio({ chatId, initialMessages, initialMeditationId }: StudioProps) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<StudioUIMessage>({
        api: "/api/chat",
        // The route keeps the history; send only the newest message.
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { chatId: id, message: messages.at(-1) },
        }),
      }),
    [],
  );

  const { messages, sendMessage, regenerate, stop, status, error, addToolOutput } =
    useChat<StudioUIMessage>({
      id: chatId,
      messages: initialMessages,
      transport,
      sendAutomaticallyWhen: answeredAudioCard,
    });

  const live = status === "submitted" || status === "streaming";
  const drafts = useMemo(() => collectDrafts(messages), [messages]);
  const draft = drafts.at(-1) ?? null;
  const details = useMemo(() => latestDetails(messages), [messages]);

  const meditationId = useMemo(() => {
    for (let m = messages.length - 1; m >= 0; m--) {
      for (const part of messages[m].parts) {
        if (part.type === "tool-writeScript" && part.state === "output-available") {
          return part.output.meditationId;
        }
      }
    }
    return initialMeditationId;
  }, [messages, initialMeditationId]);

  // /create hands over the first request through sessionStorage, so it is
  // sent from here, where the stream is watched. Deferred a tick and
  // cancelled on cleanup: useChat stops its chat when an effect pass is torn
  // down (Strict Mode, a fast remount), which would abort a send made in the
  // first pass. The key is removed only when the send goes out.
  useEffect(() => {
    if (initialMessages.length > 0) return;
    const timer = setTimeout(() => {
      let text: string | null = null;
      try {
        text = sessionStorage.getItem(firstMessageKey(chatId));
        sessionStorage.removeItem(firstMessageKey(chatId));
      } catch {
        // Storage blocked: the person types the request again.
      }
      if (text) void sendMessage({ text });
    }, 0);
    return () => clearTimeout(timer);
  }, [chatId, initialMessages.length, sendMessage]);

  // Phone: the canvas is a sheet, and a pill in the chat says when it has
  // something new. A draft already there on load is not news.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [seenDraft, setSeenDraft] = useState(draft?.toolCallId ?? null);
  const canvasRef = useRef<HTMLElement>(null);

  // Opening or closing both count as seen, so a draft that lands while the
  // sheet is open raises no pill once it closes.
  const openSheet = useCallback(
    (open: boolean) => {
      setSheetOpen(open);
      if (draft) setSeenDraft(draft.toolCallId);
    },
    [draft],
  );

  const openCanvas = useCallback(() => {
    if (window.matchMedia("(min-width: 48rem)").matches) {
      canvasRef.current?.focus();
    } else {
      openSheet(true);
    }
  }, [openSheet]);

  const showPill = !!draft && draft.toolCallId !== seenDraft && !sheetOpen;
  const writing = live && !!draft?.streaming;

  const last = messages.at(-1);
  const thinking =
    status === "submitted" ||
    (status === "streaming" &&
      last?.role === "assistant" &&
      !last.parts.some((p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-")));
  const unanswered =
    messages.length === initialMessages.length && initialMessages.at(-1)?.role === "user";

  const studio: StudioContextValue = {
    chatId,
    meditationId,
    openCanvas,
    addToolOutput,
    status,
  };

  return (
    <StudioProvider value={studio}>
      {/* Fills the viewport under the nav, less the shell's own padding, so
          the composer sits at the bottom and each pane scrolls on its own. */}
      <div className="grid h-[calc(100dvh-9rem)] gap-6 sm:h-[calc(100dvh-11rem)] md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Chat
          messages={messages}
          drafts={drafts}
          live={live}
          thinking={thinking}
          error={error ? describeChatError(error) : null}
          unanswered={unanswered}
          onSend={(text) => void sendMessage({ text })}
          onRetry={() => void regenerate()}
          onStop={() => void stop()}
          pill={
            showPill && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => openSheet(true)}
                className="rounded-full"
              >
                {writing ? (
                  <Loader2 className="motion-safe:animate-spin" aria-hidden />
                ) : (
                  <FileText aria-hidden />
                )}
                {writing ? "Writing the script" : "Script updated"}
              </Button>
            )
          }
        />
        <ScriptCanvas
          ref={canvasRef}
          draft={draft}
          details={details}
          live={live}
          className="hidden md:flex"
        />
      </div>

      <Sheet open={sheetOpen} onOpenChange={openSheet}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[88dvh] gap-0 rounded-t-xl border-x-0 bg-background p-0 md:hidden"
        >
          <SheetTitle className="sr-only">Script</SheetTitle>
          <SheetDescription className="sr-only">The script the agent is writing.</SheetDescription>
          <ScriptCanvas
            draft={draft}
            details={details}
            live={live}
            className="flex-1 rounded-none border-0 bg-background"
            action={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => openSheet(false)}
                className="-mr-2 size-8"
                aria-label="Close script"
              >
                <X aria-hidden />
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </StudioProvider>
  );
}
