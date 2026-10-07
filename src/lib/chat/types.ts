import type { ConversationType, MessageType } from "@/db/schema";

export type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderActive: boolean;
  type: MessageType;
  body: string | null;
  replyTo: {
    id: number;
    body: string | null;
    senderName: string;
    deleted: boolean;
  } | null;
  clientId: string;
  editedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
};

export type ConversationSummary = {
  id: number;
  type: ConversationType;
  title: string;
  avatarPath: string | null;
  peerActive: boolean;
  lastBody: string | null;
  lastAt: number | null;
  unread: number;
  pinned: boolean;
  lastReadMessageId: number | null;
};

export const CHAT_BODY_MAX = 4000;
export const CHAT_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const CHAT_PAGE_SIZE = 40;
