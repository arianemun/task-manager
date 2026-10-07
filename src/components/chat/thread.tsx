"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { fa } from "@/lib/i18n/fa";
import { linkify } from "@/lib/chat/linkify";
import { chatClock, chatDayLabel } from "@/lib/chat/time";
import { CHAT_EDIT_WINDOW_MS, type ChatMessage } from "@/lib/chat/types";
import { cn, toFaDigits } from "@/lib/utils";
import { markChatReadAction, olderMessagesAction } from "@/server/actions/chat";
import { loadOutbox, newClientId, removeOutbox, saveOutbox, type OutboxItem } from "./outbox";
import { chatSocket } from "./socket";

type Row = ChatMessage & { localStatus?: "sending" | "failed" };

const START_INDEX = 100_000;

export function ChatThread({
  conversationId,
  meId,
  title,
  initial,
  lastReadMessageId,
}: {
  conversationId: number;
  meId: number;
  title: string;
  initial: ChatMessage[];
  lastReadMessageId: number | null;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [firstItemIndex, setFirstItemIndex] = useState(START_INDEX);
  const [hasMore, setHasMore] = useState(initial.length >= 40);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [menu, setMenu] = useState<ChatMessage | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const virtuoso = useRef<VirtuosoHandle>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const loadingOlder = useRef(false);

  const merge = useCallback((message: ChatMessage) => {
    setRows((prev) => {
      const byClient = prev.findIndex((row) => row.clientId === message.clientId);
      const byId = prev.findIndex((row) => row.id === message.id);
      const index = byId >= 0 ? byId : byClient;
      if (index >= 0) {
        const next = prev.slice();
        next[index] = message;
        return next;
      }
      return [...prev, message];
    });
  }, []);

  const sendPayload = useCallback(
    (item: OutboxItem) => {
      const socket = chatSocket();
      socket.emit(
        "message:send",
        {
          conversationId: item.conversationId,
          body: item.body,
          clientId: item.clientId,
          replyToId: item.replyToId,
        },
        (ack: { ok: boolean; message?: ChatMessage; error?: string }) => {
          if (ack?.ok && ack.message) {
            merge(ack.message);
            void removeOutbox(item.clientId);
            return;
          }
          void saveOutbox({ ...item, status: "failed" });
          setRows((prev) =>
            prev.map((row) =>
              row.clientId === item.clientId ? { ...row, localStatus: "failed" } : row,
            ),
          );
        },
      );
    },
    [merge],
  );

  useEffect(() => {
    document.documentElement.dataset.chatThread = "open";
    return () => {
      delete document.documentElement.dataset.chatThread;
    };
  }, []);

  useEffect(() => {
    const socket = chatSocket();
    socket.emit("conversation:watch", { conversationId });
    const lastId = rows.reduce((max, row) => Math.max(max, row.id > 0 ? row.id : 0), 0);
    socket.emit(
      "sync:after",
      { conversationId, afterId: lastId },
      (ack: { ok: boolean; messages?: ChatMessage[] }) => {
        if (!ack?.ok || !ack.messages) return;
        for (const message of ack.messages) merge(message);
      },
    );
    const onNew = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return;
      merge(message);
      setAtBottom((bottom) => {
        if (!bottom && message.senderId !== meId) setNewCount((n) => n + 1);
        return bottom;
      });
    };
    const onUpdated = (message: ChatMessage) => {
      if (message.conversationId === conversationId) merge(message);
    };
    socket.on("message:new", onNew);
    socket.on("message:updated", onUpdated);
    const flush = () => {
      void loadOutbox(conversationId).then((items) => {
        for (const item of items.sort((a, b) => a.createdAt - b.createdAt)) {
          sendPayload(item);
        }
      });
    };
    socket.on("connect", flush);
    if (socket.connected) flush();
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:updated", onUpdated);
      socket.off("connect", flush);
    };
    // فقط با عوض شدن گفتگو دوباره وصل شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, meId, merge, sendPayload]);

  useEffect(() => {
    const last = rows.at(-1);
    if (last && last.id > 0 && atBottom) void markChatReadAction(conversationId, last.id);
  }, [rows, atBottom, conversationId]);

  useEffect(() => {
    if (lastReadMessageId == null) return;
    const index = initial.findIndex((row) => row.id > lastReadMessageId);
    if (index > 0) virtuoso.current?.scrollToIndex({ index, align: "center" });
  }, [conversationId, initial, lastReadMessageId]);

  function loadOlder() {
    const oldest = rows.find((row) => row.id > 0);
    if (!oldest || !hasMore || loadingOlder.current) return;
    loadingOlder.current = true;
    void olderMessagesAction(conversationId, oldest.id).then((result) => {
      loadingOlder.current = false;
      if (!result.ok || result.messages.length === 0) {
        setHasMore(false);
        return;
      }
      setFirstItemIndex((value) => value - result.messages.length);
      setRows((prev) => [...result.messages, ...prev.filter((row) => row.id > 0 || row.localStatus)]);
      if (result.messages.length < 40) setHasMore(false);
    });
  }

  function queueSend(body: string) {
    const clientId = newClientId();
    const item: OutboxItem = {
      clientId,
      conversationId,
      body,
      replyToId: reply?.id ?? null,
      status: "pending",
      createdAt: Date.now(),
    };
    const optimistic: Row = {
      id: -Date.now(),
      conversationId,
      senderId: meId,
      senderName: "",
      senderActive: true,
      type: "TEXT",
      body,
      replyTo: reply
        ? {
            id: reply.id,
            body: reply.body,
            senderName: reply.senderName,
            deleted: reply.deletedAt != null,
          }
        : null,
      clientId,
      editedAt: null,
      deletedAt: null,
      createdAt: Date.now(),
      localStatus: "sending",
    };
    setRows((prev) => [...prev, optimistic]);
    setDraft("");
    setReply(null);
    void saveOutbox(item).then(() => sendPayload(item));
  }

  function onSubmit() {
    const body = draft.trim();
    if (!body) return;
    if (editing) {
      chatSocket().emit(
        "message:edit",
        { messageId: editing.id, body },
        (ack: { ok: boolean; message?: ChatMessage }) => {
          if (ack?.ok && ack.message) merge(ack.message);
        },
      );
      setEditing(null);
      setDraft("");
      return;
    }
    queueSend(body);
  }

  function openMenu(message: ChatMessage, mobile: boolean) {
    setMenu(message);
    setMobileMenu(mobile);
  }

  const actions = menu ? (
    <div className="flex flex-col p-2">
      <button type="button" className="min-h-11 rounded-md px-3 text-start" onClick={() => { setReply(menu); setMenu(null); }}>
        {fa.chat.reply}
      </button>
      {menu.body ? (
        <button
          type="button"
          className="min-h-11 rounded-md px-3 text-start"
          onClick={() => {
            void navigator.clipboard.writeText(menu.body ?? "");
            setMenu(null);
          }}
        >
          {fa.chat.copy}
        </button>
      ) : null}
      {menu.senderId === meId &&
      !menu.deletedAt &&
      Date.now() - menu.createdAt < CHAT_EDIT_WINDOW_MS ? (
        <button
          type="button"
          className="min-h-11 rounded-md px-3 text-start"
          onClick={() => {
            setEditing(menu);
            setDraft(menu.body ?? "");
            setMenu(null);
          }}
        >
          {fa.common.edit}
        </button>
      ) : null}
      {menu.senderId === meId && !menu.deletedAt ? (
        <button
          type="button"
          className="min-h-11 rounded-md px-3 text-start"
          onClick={() => {
            chatSocket().emit("message:delete", { messageId: menu.id });
            setMenu(null);
          }}
        >
          {fa.common.delete}
        </button>
      ) : null}
    </div>
  ) : null;

  const grouped = useMemo(() => rows, [rows]);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="chat-pad-x flex items-center gap-2 border-b py-3">
        <Link href="/chat" className="md:hidden" aria-label={fa.chat.back}>
          <ArrowRight className="size-5" />
        </Link>
        <h2 className="truncate font-semibold">{title}</h2>
      </div>
      <Virtuoso
        ref={virtuoso}
        className="min-h-0 flex-1"
        data={grouped}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={Math.max(0, grouped.length - 1)}
        followOutput={(bottom) => (bottom ? "auto" : false)}
        atBottomStateChange={(bottom) => {
          setAtBottom(bottom);
          if (bottom) setNewCount(0);
        }}
        startReached={loadOlder}
        itemContent={(index, message) => {
          const local = index - firstItemIndex;
          const prev = grouped[local - 1];
          const showDay =
            !prev || chatDayLabel(prev.createdAt) !== chatDayLabel(message.createdAt);
          const groupedWithPrev =
            prev &&
            prev.senderId === message.senderId &&
            !showDay &&
            !prev.deletedAt &&
            !message.deletedAt;
          return (
            <div className="chat-pad-x py-1">
              {showDay ? (
                <p className="text-muted-foreground py-2 text-center text-xs">
                  {chatDayLabel(message.createdAt)}
                </p>
              ) : null}
              <article
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-[1.7]",
                  message.senderId === meId
                    ? "bg-primary text-primary-foreground ms-auto"
                    : "bg-muted",
                )}
                onContextMenu={(event) => {
                  if (message.id < 0) return;
                  event.preventDefault();
                  openMenu(message, false);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType !== "touch" || message.id < 0) return;
                  const timer = window.setTimeout(() => openMenu(message, true), 450);
                  const clear = () => window.clearTimeout(timer);
                  event.currentTarget.addEventListener("pointerup", clear, { once: true });
                  event.currentTarget.addEventListener("pointercancel", clear, { once: true });
                }}
              >
                {!groupedWithPrev && message.senderId !== meId ? (
                  <p className="mb-1 text-xs font-medium">
                    {message.senderName}
                    {!message.senderActive ? ` (${fa.chat.inactive})` : ""}
                  </p>
                ) : null}
                {message.replyTo ? (
                  <p className="mb-1 rounded-md bg-black/10 px-2 py-1 text-xs">
                    {message.replyTo.senderName}: {message.replyTo.deleted ? fa.chat.deleted : message.replyTo.body}
                  </p>
                ) : null}
                {message.deletedAt ? (
                  <p className="italic">{fa.chat.deleted}</p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">
                    {linkify(message.body ?? "").map((part, partIndex) =>
                      part.type === "link" ? (
                        <a
                          key={partIndex}
                          href={part.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {part.value}
                        </a>
                      ) : (
                        <span key={partIndex}>{part.value}</span>
                      ),
                    )}
                  </p>
                )}
                <p className="mt-1 text-end text-[11px] opacity-80">
                  {message.localStatus === "sending"
                    ? fa.chat.sending
                    : message.localStatus === "failed"
                      ? ""
                      : chatClock(message.createdAt)}
                  {message.editedAt ? ` · ${fa.chat.edited}` : ""}
                </p>
                {message.localStatus === "failed" ? (
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => {
                      const item: OutboxItem = {
                        clientId: message.clientId,
                        conversationId,
                        body: message.body ?? "",
                        replyToId: message.replyTo?.id ?? null,
                        status: "pending",
                        createdAt: message.createdAt,
                      };
                      setRows((prev) =>
                        prev.map((row) =>
                          row.clientId === message.clientId
                            ? { ...row, localStatus: "sending" }
                            : row,
                        ),
                      );
                      void saveOutbox(item).then(() => sendPayload(item));
                    }}
                  >
                    {fa.chat.retry}
                  </button>
                ) : null}
              </article>
            </div>
          );
        }}
      />
      {!atBottom && newCount > 0 ? (
        <button
          type="button"
          className="bg-card absolute bottom-28 start-1/2 z-10 -translate-x-1/2 rounded-full border px-3 py-2 text-sm shadow"
          onClick={() => virtuoso.current?.scrollToIndex({ index: "LAST", align: "end" })}
        >
          <ArrowDown className="inline size-4" /> {fa.chat.jump} {toFaDigits(newCount)}
        </button>
      ) : null}
      {menu && !mobileMenu ? (
        <div className="bg-popover absolute bottom-28 end-4 z-10 rounded-md border shadow">
          {actions}
        </div>
      ) : null}
      <Drawer open={Boolean(menu && mobileMenu)} onOpenChange={(open) => !open && setMenu(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{fa.common.actions}</DrawerTitle>
          </DrawerHeader>
          {actions}
        </DrawerContent>
      </Drawer>
      <form
        className="chat-composer chat-pad-x border-t pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {reply || editing ? (
          <p className="text-muted-foreground mb-2 flex items-center justify-between text-xs">
            <span className="truncate">
              {editing ? fa.common.edit : fa.chat.reply}: {editing?.body ?? reply?.body}
            </span>
            <button
              type="button"
              onClick={() => {
                setReply(null);
                setEditing(null);
              }}
            >
              {fa.common.close}
            </button>
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            ref={area}
            value={draft}
            rows={1}
            placeholder={fa.chat.placeholder}
            className="border-input max-h-[9rem] min-h-11 flex-1 resize-none rounded-md border px-3 py-2 text-base leading-[1.7] md:text-sm"
            onChange={(event) => {
              setDraft(event.target.value);
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 144)}px`;
            }}
            onKeyDown={(event) => {
              const mobile = window.matchMedia("(max-width: 767px)").matches;
              if (!mobile && event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
          <Button type="submit" className="md:hidden">
            {fa.chat.send}
          </Button>
        </div>
      </form>
    </div>
  );
}
