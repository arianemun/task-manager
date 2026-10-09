"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FOREGROUND_HEARTBEAT_MS } from "@/lib/realtime/foreground";
import { chatSocket } from "./socket";

async function closeOpenChatNotifications(pathname: string) {
  const match = /^\/chat\/(\d+)$/.exec(pathname);
  if (!match || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.getNotifications) return;
  const notes = await registration.getNotifications({ tag: `chat:${match[1]}` });
  for (const note of notes) note.close();
}

export function AppPresence() {
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    const socket = chatSocket();
    let hidden = document.visibilityState === "hidden";

    const foreground = () => {
      socket.emit("presence:foreground");
    };
    const background = () => {
      socket.emit("presence:background");
    };
    const show = () => {
      const wasHidden = hidden;
      hidden = false;
      foreground();
      if (!wasHidden) return;
      void closeOpenChatNotifications(pathname);
      router.refresh();
    };
    const hide = () => {
      hidden = true;
      background();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") show();
      else hide();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", show);
    window.addEventListener("pagehide", hide);
    document.addEventListener("freeze", hide);
    document.addEventListener("resume", show);

    if (hidden) background();
    else foreground();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") foreground();
    }, FOREGROUND_HEARTBEAT_MS);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("freeze", hide);
      document.removeEventListener("resume", show);
      background();
    };
  }, [pathname, router]);

  return null;
}
