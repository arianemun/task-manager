import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { convertHeicToJpeg, transcodeImageFile } from "./transcode";

describe("تبدیل HEIC", () => {
  it("به JPEG بدون EXIF و بدون برچسب تبدیل می‌شود", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-heic-"));
    const jpeg = path.join(dir, "in.jpg");
    const heic = path.join(dir, "in.heic");
    const decoded = path.join(dir, "decoded.jpg");
    const output = path.join(dir, "out.jpg");
    try {
      execFileSync(
        "ffmpeg",
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          "color=c=red:s=64x64:d=1",
          "-frames:v",
          "1",
          "-metadata",
          "comment=SECRET_META",
          jpeg,
        ],
        { stdio: "pipe" },
      );
      execFileSync("heif-enc", [jpeg, "-o", heic], { stdio: "pipe" });
      await convertHeicToJpeg(heic, decoded);
      execFileSync(
        "ffmpeg",
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          decoded,
          "-c",
          "copy",
          "-metadata",
          "comment=SECRET_META",
          path.join(dir, "tagged.jpg"),
        ],
        { stdio: "pipe" },
      );
      await transcodeImageFile(path.join(dir, "tagged.jpg"), output);
      const bytes = fs.readFileSync(output);
      expect(bytes[0]).toBe(0xff);
      expect(bytes[1]).toBe(0xd8);
      expect(bytes.includes(Buffer.from("Exif"))).toBe(false);
      expect(bytes.includes(Buffer.from("SECRET_META"))).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
