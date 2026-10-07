"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { fa } from "@/lib/i18n/fa";
import { chatTimeLabel } from "@/lib/chat/time";
import type { ConversationSummary } from "@/lib/chat/types";
import { normalizePersianText } from "@/lib/validation/normalize";
import { cn, toFaDigits } from "@/lib/utils";
import { NewChatButton, type ChatPerson, type ChatDept } from "./new-chat";

export function ConversationList({
  items,
  people,
  departments,
  canCreateGroup,
  isAdmin,
}: {
  items: ConversationSummary[];
  people: ChatPerson[];
  departments: ChatDept[];
  canCreateGroup: boolean;
  isAdmin: boolean;
}) {
  const pathname = usePathname() || "";
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = normalizePersianText(q);
    const rows = needle
      ? items.filter((item) => normalizePersianText(item.title).includes(needle))
      : items;
    return rows;
  }, [items, q]);

  return (
    <div className="flex h-full min-h-0 flex-col border-e">
      <div className="chat-pad-x flex items-center justify-between gap-2 border-b py-3">
        <h1 className="text-base font-semibold">{fa.chat.title}</h1>
        <NewChatButton
          people={people}
          departments={departments}
          canCreateGroup={canCreateGroup}
          isAdmin={isAdmin}
        />
      </div>
      <div className="chat-pad-x py-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={fa.chat.search}
          className="border-input bg-background h-11 w-full rounded-md border px-3 text-sm"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="text-muted-foreground chat-pad-x py-8 text-center text-sm">
            {fa.chat.empty}
          </li>
        ) : (
          filtered.map((item) => {
            const active = pathname === `/chat/${item.id}`;
            return (
              <li key={item.id}>
                <Link
                  href={`/chat/${item.id}`}
                  className={cn(
                    "chat-pad-x flex min-h-14 items-center gap-3 border-b py-2",
                    active && "bg-accent",
                  )}
                >
                  <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full text-sm">
                    {item.title.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">
                        {item.title}
                        {item.type === "DIRECT" && !item.peerActive
                          ? ` (${fa.chat.inactive})`
                          : ""}
                      </span>
                      {item.lastAt ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {chatTimeLabel(item.lastAt)}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {item.lastBody ?? ""}
                    </span>
                  </span>
                  {item.unread > 0 ? (
                    <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                      {toFaDigits(item.unread)}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
