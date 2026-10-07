import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ffprobeBin, transcodeVideoFile, videoEncodeArgs, VIDEO_MAXRATE } from "./transcode";

function frameCrc(file: string): string {
  return execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", file, "-map", "0:v:0", "-f", "framecrc", "-"],
    { encoding: "utf8" },
  );
}

function probe(file: string) {
  return JSON.parse(
    execFileSync(ffprobeBin(), ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], {
      encoding: "utf8",
    }),
  ) as {
    streams: Array<{
      codec_name?: string;
      codec_type?: string;
      width?: number;
      height?: number;
      side_data_list?: Array<{ rotation?: number }>;
    }>;
    format?: { tags?: Record<string, string> };
  };
}

describe("تبدیل سبک ویدیو", () => {
  it("H.264 و AAC و 720p را بدون انکود دوباره می‌سازد و برچسب را پاک می‌کند", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-remux-"));
    const input = path.join(dir, "in.mp4");
    const output = path.join(dir, "out.mp4");
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
          "testsrc=size=640x360:rate=10:duration=1",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=1",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-shortest",
          "-metadata",
          "comment=SECRET_META",
          "-metadata",
          "location=+35.7000+051.4000/",
          input,
        ],
        { stdio: "pipe" },
      );
      const before = frameCrc(input);
      await transcodeVideoFile(input, output);
      const after = probe(output);
      const tags = after.format?.tags ?? {};
      expect(after.streams.find((stream) => stream.codec_type === "video")?.codec_name).toBe("h264");
      expect(after.streams.find((stream) => stream.codec_type === "audio")?.codec_name).toBe("aac");
      expect(after.streams.find((stream) => stream.codec_type === "video")?.width).toBe(640);
      expect(tags.comment).toBeUndefined();
      expect(tags.location).toBeUndefined();
      expect(JSON.stringify(tags)).not.toContain("SECRET_META");
      expect(frameCrc(output)).toBe(before);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("سقف بیت‌ریت را روی مسیر encode می‌گذارد", () => {
    expect(videoEncodeArgs("in.webm", "out.mp4")).toContain(VIDEO_MAXRATE);
    expect(videoEncodeArgs("in.webm", "out.mp4")).toContain("veryfast");
  });
});
