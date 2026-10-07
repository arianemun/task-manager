import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STRIP_METADATA_ARGS, ffprobeBin, transcodeVideoFile, writeThumbnail } from "./transcode";

type Probe = {
  streams: Array<{
    width?: number;
    height?: number;
    side_data_list?: Array<{ rotation?: number }>;
  }>;
  format?: { tags?: Record<string, string> };
};

function ffprobe(file: string): Probe {
  const stdout = execFileSync(
    ffprobeBin(),
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
    { encoding: "utf8" },
  );
  return JSON.parse(stdout) as Probe;
}

function withRotation90(file: string): void {
  const data = fs.readFileSync(file);
  const idx = data.indexOf("tkhd");
  if (idx < 0) throw new Error("tkhd");
  const matrix = Buffer.alloc(36);
  const values = [0, 65536, 0, -65536, 0, 0, 0, 0, 65536];
  values.forEach((value, i) => matrix.writeInt32BE(value, i * 4));
  matrix.copy(data, idx + 44);
  fs.writeFileSync(file, data);
}

describe("حذف متادیتای ویدیو", () => {
  it("چرخش عمودی را روی تصویر می‌نویسد و مکان و برچسب‌ها را پاک می‌کند", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-meta-"));
    const base = path.join(dir, "base.mp4");
    const tagged = path.join(dir, "tagged.mp4");
    const output = path.join(dir, "out.mp4");
    const thumb = path.join(dir, "thumb.jpg");
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
          "testsrc=size=320x180:rate=10:duration=1",
          "-c:v",
          "mpeg4",
          "-q:v",
          "8",
          "-an",
          base,
        ],
        { stdio: "pipe" },
      );
      withRotation90(base);
      execFileSync(
        "ffmpeg",
        [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-noautorotate",
          "-i",
          base,
          "-c",
          "copy",
          "-metadata",
          "comment=SECRET_META",
          "-metadata",
          "title=private",
          "-metadata",
          "location=+35.7000+051.4000/",
          "-metadata",
          "com.apple.quicktime.model=iPhone",
          "-metadata",
          "creation_time=2020-01-01T00:00:00Z",
          tagged,
        ],
        { stdio: "pipe" },
      );
      const before = ffprobe(tagged);
      expect(before.format?.tags?.comment).toBe("SECRET_META");
      expect(before.format?.tags?.location).toContain("+35.7000");
      expect(before.streams[0]?.side_data_list?.[0]?.rotation).toBe(-90);

      await transcodeVideoFile(tagged, output);
      await writeThumbnail(output, thumb, { at: "0.2" });
      const after = ffprobe(output);
      const tags = after.format?.tags ?? {};
      expect(after.streams[0]?.width).toBe(180);
      expect(after.streams[0]?.height).toBe(320);
      expect(after.streams[0]?.side_data_list?.[0]?.rotation ?? 0).toBe(0);
      for (const key of ["comment", "title", "location", "location-eng", "creation_time", "model"]) {
        expect(tags[key]).toBeUndefined();
      }
      expect(JSON.stringify(tags)).not.toContain("SECRET_META");
      expect(JSON.stringify(tags)).not.toContain("iPhone");
      expect(JSON.stringify(ffprobe(thumb).format?.tags ?? {})).not.toContain("SECRET_META");
      expect(STRIP_METADATA_ARGS).toEqual(["-map_metadata", "-1", "-map_chapters", "-1"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
