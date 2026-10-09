import { describe, expect, it } from "vitest";
import { splitChatRecipients } from "@/lib/push/policy";
import {
  FOREGROUND_TTL_MS,
  collectChatAudience,
  isSocketForeground,
  type SocketForeground,
} from "./foreground";

const NOW = 1_700_000_000_000;

function decide(sockets: SocketForeground[], conversationId: number) {
  const audience = collectChatAudience(sockets, conversationId, NOW);
  return splitChatRecipients({
    memberIds: [1, 2],
    senderId: 1,
    foregroundUserIds: new Set(audience.foregroundUserIds),
    viewingUserIds: new Set(audience.viewingUserIds),
  });
}

describe("جلوی چشم بودن سوکت", () => {
  it("سوکت متصل که background اعلام کرده Push می‌گیرد", () => {
    expect(
      isSocketForeground(
        { backgrounded: true, foregroundAt: NOW - 1_000 },
        NOW,
      ),
    ).toBe(false);
    const split = decide(
      [
        {
          userId: 2,
          backgrounded: true,
          foregroundAt: NOW - 1_000,
          focusConversation: 9,
        },
      ],
      9,
    );
    expect(split.push).toEqual([2]);
    expect(split.toastOnly).toEqual([]);
    expect(split.skip).toEqual([]);
  });

  it("heartbeat قدیمی‌تر از ۲۰ ثانیه بدون background هم Push می‌گیرد", () => {
    expect(
      isSocketForeground(
        { backgrounded: false, foregroundAt: NOW - FOREGROUND_TTL_MS },
        NOW,
      ),
    ).toBe(false);
    expect(
      isSocketForeground(
        { backgrounded: false, foregroundAt: NOW - FOREGROUND_TTL_MS + 1 },
        NOW,
      ),
    ).toBe(true);
    const split = decide(
      [
        {
          userId: 2,
          backgrounded: false,
          foregroundAt: NOW - FOREGROUND_TTL_MS - 1,
          focusConversation: 9,
        },
      ],
      9,
    );
    expect(split.push).toEqual([2]);
  });

  it("foreground همان گفتگو هیچ نمی‌فرستد و گفتگوی دیگر فقط toast است", () => {
    const same = decide(
      [
        {
          userId: 2,
          backgrounded: false,
          foregroundAt: NOW - 5_000,
          focusConversation: 9,
        },
      ],
      9,
    );
    expect(same.skip).toEqual([2]);
    expect(same.push).toEqual([]);
    expect(same.toastOnly).toEqual([]);

    const other = decide(
      [
        {
          userId: 2,
          backgrounded: false,
          foregroundAt: NOW - 5_000,
          focusConversation: 4,
        },
      ],
      9,
    );
    expect(other.toastOnly).toEqual([2]);
    expect(other.push).toEqual([]);
  });

  it("دو دستگاه: یکی foreground باشد Push نمی‌رود", () => {
    const split = decide(
      [
        {
          userId: 2,
          backgrounded: true,
          foregroundAt: NOW - 1_000,
          focusConversation: 9,
        },
        {
          userId: 2,
          backgrounded: false,
          foregroundAt: NOW - 2_000,
          focusConversation: null,
        },
      ],
      9,
    );
    expect(split.push).toEqual([]);
    expect(split.toastOnly).toEqual([2]);
  });
});
