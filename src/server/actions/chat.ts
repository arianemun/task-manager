"use server";

import { revalidatePath } from "next/cache";
import { ChatError } from "@/lib/chat/errors";
import {
  activeMemberIds,
  createDepartmentConversation,
  createDirectConversation,
  createGroupConversation,
  listMessages,
  markRead,
} from "@/lib/chat/store";
import type { ChatMessage } from "@/lib/chat/types";
import { requirePermission, requireUser } from "@/lib/auth/user";
import { requestSocketJoin } from "@/lib/realtime/notify";

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof ChatError) return { ok: false, error: error.message };
  throw error;
}

export async function createDirectChatAction(
  peerId: number,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const id = createDirectConversation(user.id, peerId);
    requestSocketJoin(id, activeMemberIds(id));
    revalidatePath("/chat");
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function createGroupChatAction(input: {
  title: string;
  memberIds: number[];
}): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const user = await requirePermission("chat.create_group");
    const id = createGroupConversation({
      userId: user.id,
      title: input.title,
      memberIds: input.memberIds,
    });
    requestSocketJoin(id, activeMemberIds(id));
    revalidatePath("/chat");
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function createDepartmentChatAction(
  departmentId: number,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const user = await requireUser({ roles: ["ADMIN"] });
    const id = createDepartmentConversation({
      userId: user.id,
      departmentId,
    });
    requestSocketJoin(id, activeMemberIds(id));
    revalidatePath("/chat");
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function olderMessagesAction(
  conversationId: number,
  beforeId: number,
): Promise<{ ok: true; messages: ChatMessage[] } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const messages = listMessages({
      userId: user.id,
      conversationId,
      beforeId,
    });
    return { ok: true, messages };
  } catch (error) {
    return fail(error);
  }
}

export async function markChatReadAction(
  conversationId: number,
  messageId: number,
): Promise<void> {
  const user = await requireUser();
  markRead(user.id, conversationId, messageId);
}
