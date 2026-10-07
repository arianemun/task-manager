"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { fa } from "@/lib/i18n/fa";
import { cn } from "@/lib/utils";
import { chatSocket } from "./socket";

export function ChatShell({
  list,
  children,
}: {
  list: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/chat";
  const inThread = pathname !== "/chat";
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const socket = chatSocket();
    const mark = () => setOnline(socket.connected);
    socket.on("connect", mark);
    socket.on("disconnect", mark);
    mark();
    return () => {
      socket.off("connect", mark);
      socket.off("disconnect", mark);
    };
  }, []);

  return (
    <div className="chat-shell flex min-h-0 flex-col">
      {online === false ? (
        <p className="chat-pad-x bg-amber-500/15 py-2 text-center text-sm">
          {fa.chat.offline}
        </p>
      ) : online === null ? (
        <p className="chat-pad-x text-muted-foreground py-2 text-center text-sm">
          {fa.chat.connecting}
        </p>
      ) : null}
      <div className="grid min-h-0 flex-1 md:grid-cols-[20rem_minmax(0,1fr)]">
        <div className={cn("min-h-0", inThread && "hidden md:block")}>{list}</div>
        <div className={cn("min-h-0", !inThread && "hidden md:block")}>{children}</div>
      </div>
    </div>
  );
}
