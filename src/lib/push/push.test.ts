import { describe, expect, it } from "vitest";
import { subscriptionHostAllowed } from "./hosts";
import { probePushHost } from "./probe";
import { sendLabPush } from "./send";

describe("مقصد Web Push", () => {
  it("فقط سرویس‌های شناخته‌شده را می‌پذیرد", () => {
    expect(
      subscriptionHostAllowed("https://fcm.googleapis.com/fcm/send/abc"),
    ).toBe(true);
    expect(subscriptionHostAllowed("https://web.push.apple.com/q")).toBe(true);
    expect(
      subscriptionHostAllowed("https://updates.push.services.mozilla.com/wpush/v2/a"),
    ).toBe(true);
    expect(subscriptionHostAllowed("https://evil.example/push")).toBe(false);
    expect(subscriptionHostAllowed("http://fcm.googleapis.com/x")).toBe(false);
  });

  it("هاست ناموجود را بدون پروکسی رد می‌کند", async () => {
    const result = await probePushHost("invalid.invalid");
    expect(result.via).toBe("direct");
    expect(result.dns).toBe("fail");
    expect(result.tls).toBe("skipped");
  });

  it("ارسال آزمایشی به مقصد غیرمجاز به شبکه نمی‌رود", async () => {
    const result = await sendLabPush({
      endpoint: "https://evil.example/push",
      p256dh: "x",
      auth: "y",
      mode: "direct",
      title: "آزمایش",
      body: "متن",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/مجاز نیست/);
  });
});
