import { describe, expect, it } from "vitest";
import { prepareChatFile } from "./prepare-media";

describe("آماده‌سازی عکس در مرورگر", () => {
  it("اگر عکس خوانده نشود فایل خام آپلود می‌شود", async () => {
    const raw = new File([Uint8Array.from([1, 2, 3, 4])], "shot.heic", { type: "image/heic" });
    const prepared = await prepareChatFile(raw);
    expect(prepared.kind).toBe("image");
    expect(prepared.file).toBe(raw);
  });
});
