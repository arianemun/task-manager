"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { chatSocket } from "@/components/chat/socket";
import { NotificationRows } from "@/components/notifications/notification-rows";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fa } from "@/lib/i18n/fa";
import type { NotificationItem, SocketNotification } from "@/lib/notifications/types";
import { toFaDigits } from "@/lib/utils";
import { markAllNotificationsReadAction } from "@/server/actions/notifications";

function BellButton({ unread }: { unread: number }) {
  return (
    <span className="relative inline-flex size-10 items-center justify-center rounded-md">
      <Bell className="size-5" />
      {unread > 0 ? (
        <span className="bg-destructive text-destructive-foreground absolute top-1 end-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold">
          {toFaDigits(unread > 99 ? "99+" : unread)}
        </span>
      ) : null}
    </span>
  );
}

function Panel({
  items,
  onOpen,
  onMarkAll,
}: {
  items: NotificationItem[];
  onOpen: () => void;
  onMarkAll: () => void;
}) {
  return (
    <div className="flex max-h-[70dvh] flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-sm font-semibold">{fa.notifications.title}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onMarkAll}>
          {fa.notifications.markAll}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NotificationRows items={items} onOpen={onOpen} />
      </div>
      <Link href="/notifications" className="text-primary block px-3 py-3 text-center text-sm" onClick={onOpen}>
        {fa.notifications.openAll}
      </Link>
    </div>
  );
}

export function NotificationBell({
  initialUnread,
  initialItems,
}: {
  initialUnread: number;
  initialItems: NotificationItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const socket = chatSocket();
    const onNew = (incoming: SocketNotification) => {
      setItems((prev) => {
        if (prev.some((item) => item.id === incoming.id)) return prev;
        return [{ ...incoming, readAt: null }, ...prev].slice(0, 15);
      });
      setUnread((count) => count + 1);
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, []);

  function markAll() {
    void markAllNotificationsReadAction().then(() => {
      const now = Date.now();
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnread(0);
      router.refresh();
    });
  }

  const triggerClass = "text-muted-foreground hover:text-foreground inline-flex size-10 items-center justify-center rounded-md";
  const panel = <Panel items={items} onOpen={() => setOpen(false)} onMarkAll={markAll} />;

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger className={triggerClass} aria-label={fa.notifications.bell}>
          <BellButton unread={unread} />
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>{fa.notifications.title}</DrawerTitle>
          </DrawerHeader>
          {panel}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={triggerClass} aria-label={fa.notifications.bell}>
        <BellButton unread={unread} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        {panel}
      </PopoverContent>
    </Popover>
  );
}
