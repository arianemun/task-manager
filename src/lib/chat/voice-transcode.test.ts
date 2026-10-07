import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ffprobeBin, transcodeVoiceFile } from "./transcode";

describe("تبدیل ویس", () => {
  it("به AAC داخل m4a تبدیل می‌شود، موج می‌سازد و برچسب را پاک می‌کند", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-voice-"));
    const input = path.join(dir, "in.webm");
    const output = path.join(dir, "out.m4a");
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
          "sine=frequency=440:duration=1",
          "-c:a",
          "libopus",
          "-metadata",
          "comment=SECRET_META",
          "-metadata",
          "location=+35.7000+051.4000/",
          input,
        ],
        { stdio: "pipe" },
      );
      const waveform = await transcodeVoiceFile(input, output);
      const probe = JSON.parse(
        execFileSync(ffprobeBin(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", output], {
          encoding: "utf8",
        }),
      ) as {
        streams: Array<{ codec_name?: string; codec_type?: string }>;
        format?: { tags?: Record<string, string> };
      };
      expect(probe.streams.find((stream) => stream.codec_type === "audio")?.codec_name).toBe("aac");
      expect(probe.streams.some((stream) => stream.codec_type === "video")).toBe(false);
      const tags = probe.format?.tags ?? {};
      expect(tags.comment).toBeUndefined();
      expect(tags.location).toBeUndefined();
      expect(JSON.stringify(tags)).not.toContain("SECRET_META");
      expect(waveform).toHaveLength(48);
      expect(Math.max(...waveform)).toBe(100);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
