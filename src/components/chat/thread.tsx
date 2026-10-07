"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { ArrowDown, ArrowRight, ImagePlus } from "lucide-react";
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
import {
  CHAT_EDIT_WINDOW_MS,
  type ChatMessage,
  type MemberReceipt,
} from "@/lib/chat/types";
import { cn, toFaDigits } from "@/lib/utils";
import { markChatReadAction, olderMessagesAction } from "@/server/actions/chat";
import { loadOutbox, newClientId, removeOutbox, saveOutbox, type OutboxItem } from "./outbox";
import { MediaPrepareError, prepareChatFile } from "@/lib/chat/prepare-media";
import { chatSocket } from "./socket";
import { VoiceBubble } from "./voice-bubble";
import { VoiceHold } from "./voice-hold";
import { useOnlineIds } from "./use-presence";

type Row = ChatMessage & { localStatus?: "sending" | "failed"; previewUrl?: string };

const START_INDEX = 100_000;

function tickMark(messageId: number, meId: number, receipts: MemberReceipt[]) {
  const others = receipts.filter((row) => row.userId !== meId);
  if (others.length === 0) return { text: "✓", title: fa.chat.saved, read: false };
  const delivered = others.every((row) => row.deliveredId >= messageId);
  const read = others.every((row) => row.readId >= messageId);
  if (read) return { text: "✓✓", title: fa.chat.read, read: true };
  if (delivered) return { text: "✓✓", title: fa.chat.delivered, read: false };
  return { text: "✓", title: fa.chat.saved, read: false };
}

export function ChatThread({
  conversationId,
  meId,
  title,
  peerId,
  initial,
  initialReceipts,
  lastReadMessageId,
}: {
  conversationId: number;
  meId: number;
  title: string;
  peerId: number | null;
  initial: ChatMessage[];
  initialReceipts: MemberReceipt[];
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
  const [receipts, setReceipts] = useState(initialReceipts);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState("");
  const online = useOnlineIds();
  const typingIdle = useRef<number | null>(null);
  const markedRef = useRef(lastReadMessageId ?? 0);
  const router = useRouter();
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
    const onReceipt = (event: { conversationId: number; members: MemberReceipt[] }) => {
      if (event.conversationId === conversationId) setReceipts(event.members);
    };
    const onTyping = (event: {
      conversationId: number;
      userId: number;
      name: string;
      active: boolean;
    }) => {
      if (event.conversationId !== conversationId || event.userId === meId) return;
      setTypingName(event.active ? event.name : null);
    };
    socket.on("message:new", onNew);
    socket.on("message:updated", onUpdated);
    socket.on("receipt", onReceipt);
    socket.on("typing", onTyping);
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
      socket.off("receipt", onReceipt);
      socket.off("typing", onTyping);
      socket.off("connect", flush);
    };
    // فقط با عوض شدن گفتگو دوباره وصل شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, meId, merge, sendPayload]);

  useEffect(() => {
    const last = rows.at(-1);
    if (last && last.id > markedRef.current && atBottom) {
      markedRef.current = last.id;
      void markChatReadAction(conversationId, last.id).then(() => router.refresh());
      chatSocket().emit("receipt:read", { conversationId, messageId: last.id });
    }
  }, [rows, atBottom, conversationId, router]);

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
      attachment: null,
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
    chatSocket().emit("typing", { conversationId, active: false });
    if (typingIdle.current) window.clearTimeout(typingIdle.current);
    queueSend(body);
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setMediaError("");
    const clientId = newClientId();
    let previewUrl = "";
    try {
      const prepared = await prepareChatFile(file);
      previewUrl = URL.createObjectURL(prepared.file);
      const optimistic: Row = {
        id: -Date.now(),
        conversationId,
        senderId: meId,
        senderName: "",
        senderActive: true,
        type: prepared.kind === "video" ? "VIDEO" : "IMAGE",
        body: null,
        attachment: null,
        replyTo: null,
        clientId,
        editedAt: null,
        deletedAt: null,
        createdAt: Date.now(),
        localStatus: "sending",
        previewUrl,
      };
      setRows((prev) => [...prev, optimistic]);
      const body = new FormData();
      body.set("file", prepared.file);
      body.set("conversationId", String(conversationId));
      body.set("clientId", clientId);
      const response = await fetch("/api/chat/media", { method: "POST", body });
      const payload = (await response.json()) as { message?: ChatMessage; error?: string };
      if (!response.ok || !payload.message) {
        throw new MediaPrepareError(payload.error || fa.chat.mediaFailed);
      }
      URL.revokeObjectURL(previewUrl);
      merge(payload.message);
      router.refresh();
    } catch (error) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setRows((prev) => prev.filter((row) => row.clientId !== clientId));
      setMediaError(error instanceof Error ? error.message : fa.chat.mediaFailed);
    }
  }

  async function onVoice(file: File) {
    setMediaError("");
    const clientId = newClientId();
    const optimistic: Row = {
      id: -Date.now(),
      conversationId,
      senderId: meId,
      senderName: "",
      senderActive: true,
      type: "VOICE",
      body: null,
      attachment: null,
      replyTo: null,
      clientId,
      editedAt: null,
      deletedAt: null,
      createdAt: Date.now(),
      localStatus: "sending",
    };
    setRows((prev) => [...prev, optimistic]);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("kind", "voice");
      body.set("conversationId", String(conversationId));
      body.set("clientId", clientId);
      const response = await fetch("/api/chat/media", { method: "POST", body });
      const payload = (await response.json()) as { message?: ChatMessage; error?: string };
      if (!response.ok || !payload.message) {
        throw new MediaPrepareError(payload.error || fa.chat.mediaFailed);
      }
      merge(payload.message);
      router.refresh();
    } catch (error) {
      setRows((prev) => prev.filter((row) => row.clientId !== clientId));
      setMediaError(error instanceof Error ? error.message : fa.chat.mediaFailed);
    }
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
        <h2 className="min-w-0 truncate font-semibold">
          {title}
          {peerId != null ? (
            <span className="text-muted-foreground ms-2 text-xs font-normal">
              {online.includes(peerId) ? fa.chat.online : fa.chat.away}
            </span>
          ) : null}
        </h2>
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
                  <>
                    {message.previewUrl && message.type === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.previewUrl}
                        alt={fa.chat.photo}
                        className="mb-1 max-h-80 w-full rounded-md object-contain"
                      />
                    ) : null}
                    {message.previewUrl && message.type === "VIDEO" ? (
                      <video
                        src={message.previewUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="mb-1 max-h-80 w-full rounded-md"
                      />
                    ) : null}
                    {message.attachment?.status === "READY" && message.attachment.kind === "image" && message.attachment.url ? (
                      // فایل چت پشت احراز هویت است و از بهینه‌ساز عمومی next/image رد نمی‌شود.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.attachment.url}
                        alt={fa.chat.photo}
                        className="mb-1 max-h-80 w-full rounded-md object-contain"
                      />
                    ) : null}
                    {message.attachment?.status === "READY" && message.attachment.kind === "video" && message.attachment.url ? (
                      <video
                        src={message.attachment.url}
                        poster={message.attachment.thumbUrl ?? undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="mb-1 max-h-80 w-full rounded-md"
                      />
                    ) : null}
                    {message.attachment?.status === "READY" && message.attachment.kind === "voice" && message.attachment.url ? (
                      <VoiceBubble
                        url={message.attachment.url}
                        waveform={message.attachment.waveform}
                        durationMs={message.attachment.durationMs}
                      />
                    ) : null}
                    {message.attachment && message.attachment.status !== "READY" ? (
                      <p className="mb-1 text-xs">
                        {message.attachment.status === "FAILED" ? fa.chat.mediaFailed : fa.chat.mediaProcessing}
                      </p>
                    ) : null}
                  {message.body ? (
                  <p className="whitespace-pre-wrap break-words">
                    {linkify(message.body).map((part, partIndex) =>
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
                  ) : null}
                  </>
                )}
                <p className="mt-1 text-end text-[11px] opacity-80">
                  {message.localStatus === "sending"
                    ? fa.chat.sending
                    : message.localStatus === "failed"
                      ? ""
                      : chatClock(message.createdAt)}
                  {message.editedAt ? ` · ${fa.chat.edited}` : ""}
                  {message.senderId === meId && message.id > 0
                    ? (() => {
                        const tick = tickMark(message.id, meId, receipts);
                        return (
                          <span className={cn("ms-1", tick.read && "text-sky-200")} title={tick.title}>
                            {tick.text}
                          </span>
                        );
                      })()
                    : null}
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
        {mediaError ? <p className="text-destructive mb-1 text-xs">{mediaError}</p> : null}
        {typingName ? (
          <p className="text-muted-foreground mb-1 text-xs">
            {`${typingName} ${fa.chat.typing}`}
          </p>
        ) : null}
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
          <label className="border-input inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md border md:size-10">
            <ImagePlus className="size-5" />
            <span className="sr-only">{fa.chat.attach}</span>
            <input
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onPickFile(file);
              }}
            />
          </label>
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
              chatSocket().emit("typing", { conversationId, active: true });
              if (typingIdle.current) window.clearTimeout(typingIdle.current);
              typingIdle.current = window.setTimeout(() => {
                chatSocket().emit("typing", { conversationId, active: false });
              }, 3000);
            }}
            onKeyDown={(event) => {
              const mobile = window.matchMedia("(max-width: 767px)").matches;
              if (!mobile && event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
          {draft.trim() || editing ? (
            <Button type="submit" className="md:hidden">
              {fa.chat.send}
            </Button>
          ) : (
            <VoiceHold onRecorded={(file) => void onVoice(file)} onError={setMediaError} />
          )}
        </div>
      </form>
    </div>
  );
}
