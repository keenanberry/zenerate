import { notFound } from "next/navigation";
import { Studio } from "@/components/studio/studio";
import { getChat } from "@/lib/chat/actions";

export const metadata = {
  title: "Studio | Zenerate",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StudioPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  // Not a chat id at all reads the same as someone else's chat.
  const found = UUID.test(chatId) ? await getChat(chatId) : null;
  if (!found) notFound();

  return (
    <Studio
      // A new chat id is a new conversation: remount rather than carry state over.
      key={chatId}
      chatId={chatId}
      initialMessages={found.messages}
      initialMeditationId={found.chat.meditation_id}
    />
  );
}
