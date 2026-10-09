"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncPushSubscription } from "@/lib/push/browser";

export function PushSync() {
  const router = useRouter();

  useEffect(() => {
    const run = () => {
      void syncPushSubscription().catch(() => undefined);
    };
    run();
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type === "push-navigate" && data.url?.startsWith("/")) {
        router.push(data.url);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
