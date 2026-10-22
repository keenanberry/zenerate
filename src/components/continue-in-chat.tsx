import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMeditationChatId } from "@/lib/chat/actions";

/**
 * The owner's way back into the conversation that made this meditation.
 * Renders nothing when there is no chat, which is also what anyone but the
 * owner gets: chats are owner-only under RLS.
 */
export async function ContinueInChat({ meditationId }: { meditationId: string }) {
  const chatId = await getMeditationChatId(meditationId);
  if (!chatId) return null;

  return (
    <Button variant="outline" size="sm" className="gap-2" asChild>
      <Link href={`/create/${chatId}`}>
        <MessageSquare className="h-3.5 w-3.5" />
        Continue in chat
      </Link>
    </Button>
  );
}
