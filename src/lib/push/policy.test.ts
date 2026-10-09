import { describe, expect, it } from "vitest";
import {
  chatPreview,
  chatPushCopy,
  decidePush,
  inQuietHours,
  quietDigestCopy,
  quietPeriodEndMs,
  splitChatRecipients,
} from "./policy";

describe("سیاست Push", () => {
  it("بازهٔ شبانهٔ تهران ۲۲ تا ۷ را می‌شناسد", () => {
    expect(inQuietHours(new Date("2026-10-08T18:29:00Z"), "22:00", "07:00")).toBe(false);
    expect(inQuietHours(new Date("2026-10-08T18:30:00Z"), "22:00", "07:00")).toBe(true);
    expect(inQuietHours(new Date("2026-10-08T03:29:00Z"), "22:00", "07:00")).toBe(true);
    expect(inQuietHours(new Date("2026-10-08T03:30:00Z"), "22:00", "07:00")).toBe(false);
  });

  it("پایان سکوت فقط همان ده دقیقه را برای خلاصه باز می‌گذارد", () => {
    expect(quietPeriodEndMs(new Date("2026-10-09T03:29:00Z"), "22:00", "07:00")).toBeNull();
    expect(quietPeriodEndMs(new Date("2026-10-09T03:30:00Z"), "22:00", "07:00")).toBe(
      Date.parse("2026-10-09T03:30:00Z"),
    );
    expect(quietPeriodEndMs(new Date("2026-10-09T03:39:00Z"), "22:00", "07:00")).toBe(
      Date.parse("2026-10-09T03:30:00Z"),
    );
    expect(quietPeriodEndMs(new Date("2026-10-09T03:40:00Z"), "22:00", "07:00")).toBeNull();
    expect(quietDigestCopy(4)).toBe("۴ پیام و اطلاعیه خوانده‌نشده");
  });

  it("HIGH در ساعات سکوت می‌رود و ترجیح خاموش نمی‌رود", () => {
    expect(
      decidePush({
        priority: "HIGH",
        preferencePush: null,
        type: "task.overdue",
        quiet: true,
      }),
    ).toBe("send");
    expect(
      decidePush({
        priority: "NORMAL",
        preferencePush: null,
        type: "announcement.new",
        quiet: true,
      }),
    ).toBe("quiet");
    expect(
      decidePush({
        priority: "NORMAL",
        preferencePush: false,
        type: "chat.message",
        quiet: false,
      }),
    ).toBe("preference");
  });

  it("پیش‌نمایش متن کوتاه و برچسب رسانه می‌سازد", () => {
    expect(chatPreview({ type: "VOICE", body: null, hideText: false })).toBe("🎤 پیام صوتی");
    expect(chatPreview({ type: "IMAGE", body: null, hideText: true })).toBe("📷 عکس");
    expect(chatPreview({ type: "VIDEO", body: null, hideText: false })).toBe("🎬 ویدیو");
    expect(chatPreview({ type: "TEXT", body: "سلام", hideText: true })).toBe("پیام جدید");
    expect(chatPreview({ type: "TEXT", body: "سلام بر شما", hideText: false })).toBe("سلام بر شما");
  });

  it("پیام‌های پشت‌سرهم را در عنوان جمع می‌کند", () => {
    expect(chatPushCopy({ count: 1, senderName: "علی", preview: "سلام" })).toEqual({
      title: "علی",
      body: "سلام",
    });
    expect(chatPushCopy({ count: 3, senderName: "علی", preview: "سلام" }).title).toBe(
      "۳ پیام جدید",
    );
  });

  it("گفتگوی باز Push نمی‌گیرد و کاربر آنلاین فقط toast است", () => {
    const split = splitChatRecipients({
      memberIds: [1, 2, 3, 4],
      senderId: 1,
      foregroundUserIds: new Set([2, 3]),
      viewingUserIds: new Set([2]),
    });
    expect(split.skip).toEqual([2]);
    expect(split.toastOnly).toEqual([3]);
    expect(split.push).toEqual([4]);
  });
});
