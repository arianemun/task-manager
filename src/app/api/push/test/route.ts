import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/user";
import { sendWebPush } from "@/lib/push/send";
import { activePushSubscriptions, notePushFailure, notePushSuccess, deletePushSubscriptionByEndpoint } from "@/lib/push/subscriptions";
import { PUSH_FAIL_DISABLE } from "@/lib/push/policy";
import { countUnreadNotifications } from "@/lib/notifications/store";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireUser();
    const subs = activePushSubscriptions(user.id);
    if (subs.length === 0) {
      return NextResponse.json({ ok: false, error: "دستگاهی ثبت نشده" }, { status: 400 });
    }
    const badge = countUnreadNotifications(user.id);
    let sent = 0;
    for (const sub of subs) {
      const result = await sendWebPush({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        title: "اعلان آزمایشی",
        body: "اگر این را می‌بینید، اعلان این دستگاه روشن است.",
        url: "/me/profile",
        tag: "push-test",
        badge,
      });
      if (result.ok) {
        sent += 1;
        notePushSuccess(sub.id);
      } else if (result.statusCode === 404 || result.statusCode === 410) {
        deletePushSubscriptionByEndpoint(sub.endpoint);
      } else {
        notePushFailure(sub.id, Date.now(), PUSH_FAIL_DISABLE);
      }
    }
    return NextResponse.json(
      sent > 0 ? { ok: true, sent } : { ok: false, error: "ارسال به دستگاه‌ها انجام نشد" },
      { status: sent > 0 ? 200 : 502 },
    );
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}
