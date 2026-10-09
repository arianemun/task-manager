import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/user";
import { deletePushSubscription, upsertPushSubscription } from "@/lib/push/subscriptions";

export const runtime = "nodejs";

function deviceLabel(userAgent: string): string {
  if (/iPhone|iPad/.test(userAgent)) return "iPhone";
  if (/Android/.test(userAgent)) return "Android";
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\//.test(userAgent)) return "Chrome";
  return "مرورگر";
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
      previousEndpoint?: string | null;
    };
    if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
      return NextResponse.json({ error: "اشتراک ناقص است" }, { status: 400 });
    }
    const userAgent = request.headers.get("user-agent");
    const saved = upsertPushSubscription({
      userId: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent,
      deviceLabel: deviceLabel(userAgent ?? ""),
      previousEndpoint: body.previousEndpoint,
    });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "اشتراک ناقص است" }, { status: 400 });
    }
    deletePushSubscription(user.id, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}
