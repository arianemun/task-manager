import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat/thread";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import {
  getConversationForUser,
  listMessages,
  markRead,
  memberReceipts,
} from "@/lib/chat/store";

export default async function ChatThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) notFound();

  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
    forbiddenPath: "/login",
  });
  const conversation = getConversationForUser(user.id, conversationId);
  if (!conversation) notFound();

  const messages = listMessages({ userId: user.id, conversationId });
  const last = messages.at(-1);
  if (last) markRead(user.id, conversationId, last.id);

  return (
    <ChatThread
      conversationId={conversationId}
      meId={user.id}
      title={conversation.title}
      peerId={conversation.peerId}
      initial={messages}
      initialReceipts={memberReceipts(conversationId)}
      lastReadMessageId={conversation.lastReadMessageId}
    />
  );
}
