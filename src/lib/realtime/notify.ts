function endpoint(path: string): string | null {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return null;
  const port = process.env.REALTIME_PORT || "3231";
  return `http://127.0.0.1:${port}${path}`;
}

function post(path: string, body: unknown, timeoutMs = 800): void {
  const url = endpoint(path);
  const secret = process.env.INTERNAL_SECRET;
  if (!url || !secret) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  void fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timer));
}

export function requestSocketDisconnect(userId: number): void {
  post("/internal/disconnect", { userId });
}

export function requestSocketJoin(conversationId: number, userIds: number[]): void {
  post("/internal/join", { conversationId, userIds });
}

export function requestChatFanout(message: {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  type: string;
  body: string | null;
}): void {
  post("/internal/chat-message", { message }, 2000);
}

export function requestSocketNotify(
  userId: number,
  notification: {
    id: number;
    type: string;
    title: string;
    body: string;
    url: string | null;
    priority: "LOW" | "NORMAL" | "HIGH";
    createdAt: number;
  },
): void {
  post("/internal/notify", { userId, notification });
}
