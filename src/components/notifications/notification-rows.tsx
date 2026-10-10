"use client";

import { useRouter } from "next/navigation";
import {
  AlarmClock,
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardList,
  Clock,
  Megaphone,
  MessageSquare,
  PieChart,
} from "lucide-react";
import { chatTimeLabel } from "@/lib/chat/time";
import type { NotificationItem } from "@/lib/notifications/types";
import { fa } from "@/lib/i18n/fa";
import { cn } from "@/lib/utils";
import { markNotificationReadAction } from "@/server/actions/notifications";

function TypeIcon({ type }: { type: string }) {
  const Icon =
    type === "task.assigned"
      ? ClipboardList
      : type === "task.daily_digest"
        ? CalendarDays
        : type === "task.due_soon"
          ? Clock
          : type === "task.overdue"
            ? AlarmClock
            : type === "task.manager_summary"
              ? PieChart
              : type.startsWith("chat.")
                ? MessageSquare
                : type.startsWith("announcement.")
                  ? Megaphone
                  : type.startsWith("system.")
                    ? AlertTriangle
                    : Bell;
  return <Icon className="text-muted-foreground size-5 shrink-0" />;
}

export function NotificationRows({
  items,
  onOpen,
}: {
  items: NotificationItem[];
  onOpen?: () => void;
}) {
  const router = useRouter();
  if (items.length === 0) {
    return <p className="text-muted-foreground px-3 py-6 text-center text-sm">{fa.notifications.empty}</p>;
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} className="border-border border-b last:border-b-0">
          <button
            type="button"
            className="hover:bg-accent/60 flex min-h-[68px] w-full items-center gap-3 px-3 py-2 text-start"
            onClick={() => {
              if (!item.readAt) void markNotificationReadAction(item.id);
              onOpen?.();
              if (item.url) router.push(item.url);
              else router.refresh();
            }}
          >
            <TypeIcon type={item.type} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-[15px]", item.readAt ? "font-normal" : "font-semibold")}>
                  {item.title}
                </span>
                <time className="text-muted-foreground shrink-0 text-xs">{chatTimeLabel(item.createdAt)}</time>
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {item.type in fa.notifications.types
                  ? fa.notifications.types[item.type as keyof typeof fa.notifications.types]
                  : null}
              </span>
              <span className="text-muted-foreground block truncate text-sm">{item.body}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
