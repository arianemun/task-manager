"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { fa } from "@/lib/i18n/fa";
import type { ChatMessage } from "@/lib/chat/types";
import { chatSocket } from "./socket";

export function ChatNotifier({ userId }: { userId: number }) {
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    const socket = chatSocket();
    const onMessage = (message: ChatMessage) => {
      if (message.senderId === userId) return;
      if (pathname === `/chat/${message.conversationId}`) return;
      toast(message.senderName, {
        description:
          message.body ??
          (message.type === "IMAGE"
            ? fa.chat.photo
            : message.type === "VIDEO"
              ? fa.chat.video
              : fa.chat.deleted),
        action: {
          label: fa.chat.openChat,
          onClick: () => router.push(`/chat/${message.conversationId}`),
        },
      });
      router.refresh();
    };
    socket.on("message:new", onMessage);
    return () => {
      socket.off("message:new", onMessage);
    };
  }, [pathname, router, userId]);

  return null;
}
