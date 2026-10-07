import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/user";
import { sendLabPush, type PushSendMode } from "@/lib/push/send";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireUser({ roles: ["ADMIN"] });
    const body = (await request.json()) as {
      mode?: string;
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const mode: PushSendMode = body.mode === "proxy" ? "proxy" : "direct";
    if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
      return NextResponse.json({ error: "اشتراک ناقص است" }, { status: 400 });
    }
    const result = await sendLabPush({
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      mode,
      title: "آزمایش اعلان",
      body: "این پیام فقط برای آزمایش رسیدن Web Push است.",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}
