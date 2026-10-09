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
    const sendFocus = () => {
      const match = /^\/chat\/(\d+)$/.exec(pathname);
      const visible = document.visibilityState === "visible";
      socket.emit("conversation:focus", {
        conversationId: visible && match ? Number(match[1]) : null,
      });
    };
    sendFocus();
    document.addEventListener("visibilitychange", sendFocus);
    return () => {
      document.removeEventListener("visibilitychange", sendFocus);
      socket.emit("conversation:focus", { conversationId: null });
    };
  }, [pathname]);

  useEffect(() => {
    const socket = chatSocket();
    const onMessage = (message: ChatMessage) => {
      if (message.senderId === userId) return;
      if (document.visibilityState !== "visible") return;
      if (pathname === `/chat/${message.conversationId}`) return;
      toast(message.senderName, {
        description:
          message.body ??
          (message.type === "IMAGE"
            ? fa.chat.photo
            : message.type === "VIDEO"
              ? fa.chat.video
              : message.type === "VOICE"
                ? fa.chat.voice
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
