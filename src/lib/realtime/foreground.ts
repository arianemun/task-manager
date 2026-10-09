/** فاصلهٔ heartbeat کلاینت وقتی صفحه نمایان است. */
export const FOREGROUND_HEARTBEAT_MS = 10_000;
/** بدون heartbeat تازه، سوکت دیگر جلوی چشم حساب نمی‌شود. */
export const FOREGROUND_TTL_MS = 20_000;
/** Socket.IO: فاصلهٔ ping و مهلت pong. اتصال مرده حداکثر در جمع این دو قطع می‌شود. */
export const SOCKET_PING_INTERVAL_MS = 10_000;
export const SOCKET_PING_TIMEOUT_MS = 8_000;

export type SocketForeground = {
  userId: number;
  backgrounded: boolean;
  foregroundAt: number | null;
  focusConversation: number | null;
};

export function isSocketForeground(
  socket: Pick<SocketForeground, "backgrounded" | "foregroundAt">,
  now: number,
): boolean {
  if (socket.backgrounded) return false;
  if (socket.foregroundAt == null) return false;
  return now - socket.foregroundAt < FOREGROUND_TTL_MS;
}

export function collectChatAudience(
  sockets: SocketForeground[],
  conversationId: number,
  now: number,
): { foregroundUserIds: number[]; viewingUserIds: number[] } {
  const foregroundUserIds: number[] = [];
  const viewingUserIds: number[] = [];
  const seenForeground = new Set<number>();
  const seenViewing = new Set<number>();
  for (const socket of sockets) {
    if (!isSocketForeground(socket, now)) continue;
    if (!seenForeground.has(socket.userId)) {
      seenForeground.add(socket.userId);
      foregroundUserIds.push(socket.userId);
    }
    if (socket.focusConversation === conversationId && !seenViewing.has(socket.userId)) {
      seenViewing.add(socket.userId);
      viewingUserIds.push(socket.userId);
    }
  }
  return { foregroundUserIds, viewingUserIds };
}
