import webpush from "web-push";
import { subscriptionHostAllowed } from "./hosts";

export type PushSendMode = "direct" | "proxy";

export type PushSendResult = {
  ok: boolean;
  statusCode: number | null;
  via: PushSendMode;
  endpointHost: string;
  elapsedMs: number;
  error: string | null;
};

function vapidConfig(): { subject: string; publicKey: string; privateKey: string } {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@task.khanemadari.com";
  if (!publicKey || !privateKey) {
    throw new Error("کلید VAPID تنظیم نشده");
  }
  return { subject, publicKey, privateKey };
}

export type WebPushResult = {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
};

export async function sendWebPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  url: string;
  tag?: string | null;
  badge?: number;
}): Promise<WebPushResult> {
  if (!subscriptionHostAllowed(input.endpoint)) {
    return { ok: false, statusCode: null, error: "مقصد اشتراک مجاز نیست" };
  }
  const keys = vapidConfig();
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag ?? null,
    badge: input.badge ?? 0,
  });
  try {
    const result = await webpush.sendNotification(
      {
        endpoint: input.endpoint,
        keys: { p256dh: input.p256dh, auth: input.auth },
      },
      payload,
      { TTL: 60 },
    );
    return {
      ok: result.statusCode >= 200 && result.statusCode < 300,
      statusCode: result.statusCode,
      error: null,
    };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    const message = error instanceof Error ? error.message : "ارسال ناموفق";
    return { ok: false, statusCode, error: message.slice(0, 300) };
  }
}

export async function sendLabPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  mode: PushSendMode;
  title: string;
  body: string;
}): Promise<PushSendResult> {
  const started = Date.now();
  let endpointHost = "";
  try {
    endpointHost = new URL(input.endpoint).hostname;
  } catch {
    endpointHost = "";
  }
  if (!subscriptionHostAllowed(input.endpoint)) {
    return {
      ok: false,
      statusCode: null,
      via: input.mode,
      endpointHost,
      elapsedMs: Date.now() - started,
      error: "مقصد اشتراک مجاز نیست",
    };
  }
  const proxy = process.env.PUSH_PROXY_URL?.trim() || "";
  if (input.mode === "proxy" && !proxy) {
    return {
      ok: false,
      statusCode: null,
      via: input.mode,
      endpointHost,
      elapsedMs: Date.now() - started,
      error: "PUSH_PROXY_URL تنظیم نشده",
    };
  }
  const keys = vapidConfig();
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  try {
    const result = await webpush.sendNotification(
      {
        endpoint: input.endpoint,
        keys: { p256dh: input.p256dh, auth: input.auth },
      },
      JSON.stringify({
        title: input.title,
        body: input.body,
        url: "/admin/push-lab",
        tag: null,
        badge: 0,
      }),
      input.mode === "proxy" ? { proxy, TTL: 60 } : { TTL: 60 },
    );
    return {
      ok: result.statusCode >= 200 && result.statusCode < 300,
      statusCode: result.statusCode,
      via: input.mode,
      endpointHost,
      elapsedMs: Date.now() - started,
      error: null,
    };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    const message = error instanceof Error ? error.message : "ارسال ناموفق";
    return {
      ok: false,
      statusCode,
      via: input.mode,
      endpointHost,
      elapsedMs: Date.now() - started,
      error: message.slice(0, 300),
    };
  }
}
