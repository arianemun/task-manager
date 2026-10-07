import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/user";
import { ChatError } from "@/lib/chat/errors";
import { createMediaMessage, createVoiceMessage } from "@/lib/chat/store";
import { CHAT_VIDEO_MAX_BYTES, CHAT_VOICE_MAX_BYTES } from "@/lib/chat/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    const conversationId = Number(form.get("conversationId"));
    const clientId = String(form.get("clientId") ?? "");
    if (!(file instanceof File) || !Number.isInteger(conversationId) || conversationId <= 0) {
      return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
    }
    const voice = String(form.get("kind") ?? "") === "voice";
    if (file.size > (voice ? CHAT_VOICE_MAX_BYTES : CHAT_VIDEO_MAX_BYTES)) {
      return NextResponse.json(
        { error: voice ? "حجم پیام صوتی زیاد است" : "حجم ویدیو حداکثر ۱۰۰ مگابایت است" },
        { status: 400 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const message = voice
      ? await createVoiceMessage({
          userId: actor.id,
          conversationId,
          clientId,
          bytes,
        })
      : await createMediaMessage({
          userId: actor.id,
          conversationId,
          clientId,
          bytes,
        });
    return NextResponse.json({ message });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof ChatError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
