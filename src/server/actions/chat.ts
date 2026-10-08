"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
  if (error instanceof ChatError || error instanceof z.ZodError) {
    return { ok: false, error: error instanceof ChatError ? error.message : "درخواست نامعتبر است" };
  }
  throw error;
}

const positiveId = z.number().int().positive();

export async function createDirectChatAction(
  peerId: number,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const peer = positiveId.parse(peerId);
    const user = await requireUser();
    const id = createDirectConversation(user.id, peer);
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
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(80),
        memberIds: z.array(positiveId).max(100),
      })
      .parse(input);
    const id = createGroupConversation({
      userId: user.id,
      title: parsed.title,
      memberIds: parsed.memberIds,
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
      departmentId: positiveId.parse(departmentId),
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
      conversationId: positiveId.parse(conversationId),
      beforeId: positiveId.parse(beforeId),
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
  markRead(user.id, positiveId.parse(conversationId), positiveId.parse(messageId));
}
