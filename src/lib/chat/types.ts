import type { AttachmentStatus, ConversationType, MessageType } from "@/db/schema";

export type ChatAttachment = {
  id: number;
  kind: "image" | "video" | "voice";
  status: AttachmentStatus;
  url: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveform: number[] | null;
};

export type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderActive: boolean;
  type: MessageType;
  body: string | null;
  attachment: ChatAttachment | null;
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
  peerId: number | null;
};

export type MemberReceipt = {
  userId: number;
  deliveredId: number;
  readId: number;
};

export const CHAT_BODY_MAX = 4000;
export const CHAT_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const CHAT_VIDEO_MAX_MS = 5 * 60 * 1000;
export const CHAT_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const CHAT_VOICE_MAX_BYTES = 16 * 1024 * 1024;
export const CHAT_VOICE_MAX_MS = 5 * 60 * 1000;
export const CHAT_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const CHAT_PAGE_SIZE = 40;
