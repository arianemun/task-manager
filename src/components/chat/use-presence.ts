"use client";

import { useEffect, useState } from "react";
import { chatSocket } from "./socket";

export function useOnlineIds(): number[] {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    const socket = chatSocket();
    const onSnapshot = (list: number[]) => setIds(list);
    const onPresence = (event: { userId: number; online: boolean }) => {
      setIds((prev) =>
        event.online
          ? [...new Set([...prev, event.userId])]
          : prev.filter((id) => id !== event.userId),
      );
    };
    socket.on("presence:snapshot", onSnapshot);
    socket.on("presence", onPresence);
    return () => {
      socket.off("presence:snapshot", onSnapshot);
      socket.off("presence", onPresence);
    };
  }, []);

  return ids;
}
