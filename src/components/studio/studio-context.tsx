"use client";

import { createContext, useContext } from "react";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { StudioUIMessage } from "@/lib/chat/tools";
import type { CoverState } from "./drafts";

/**
 * What the studio's cards can reach without prop drilling: the chat they sit
 * in, its meditation once the first script has saved, and the canvas.
 */
export type StudioContextValue = {
  chatId: string;
  /** Null until the agent's first `writeScript` creates the meditation. */
  meditationId: string | null;
  /** Its current cover, for the canvas and the chat's draft chips. */
  cover: CoverState;
  /** Bring the script into view: the sheet on a phone, the canvas column on desktop. */
  openCanvas: () => void;
  addToolOutput: UseChatHelpers<StudioUIMessage>["addToolOutput"];
  status: UseChatHelpers<StudioUIMessage>["status"];
};

/** Where `/create` leaves the first request for the chat page to send. */
export const firstMessageKey = (chatId: string) => `studio:first:${chatId}`;

const StudioContext = createContext<StudioContextValue | null>(null);

export const StudioProvider = StudioContext.Provider;

export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside the studio");
  return value;
}
