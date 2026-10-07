import { afterEach, describe, expect, it } from "vitest";
import { ffmpegBin, ffprobeBin, heicConvertBin } from "@/lib/chat/transcode";
import { checkMediaBins } from "./bins";

describe("باینری‌های رسانه", () => {
  const previous = {
    ffmpeg: process.env.FFMPEG_BIN,
    ffprobe: process.env.FFPROBE_BIN,
    heic: process.env.HEIC_CONVERT_BIN,
  };

  afterEach(() => {
    if (previous.ffmpeg === undefined) delete process.env.FFMPEG_BIN;
    else process.env.FFMPEG_BIN = previous.ffmpeg;
    if (previous.ffprobe === undefined) delete process.env.FFPROBE_BIN;
    else process.env.FFPROBE_BIN = previous.ffprobe;
    if (previous.heic === undefined) delete process.env.HEIC_CONVERT_BIN;
    else process.env.HEIC_CONVERT_BIN = previous.heic;
  });

  it("نام باینری را از env می‌خواند و در غیر این صورت از PATH", () => {
    delete process.env.FFMPEG_BIN;
    delete process.env.FFPROBE_BIN;
    delete process.env.HEIC_CONVERT_BIN;
    expect(ffmpegBin()).toBe("ffmpeg");
    expect(ffprobeBin()).toBe("ffprobe");
    expect(heicConvertBin()).toBe("heif-convert");
    process.env.FFMPEG_BIN = "/opt/ffmpeg";
    process.env.FFPROBE_BIN = "/opt/ffprobe";
    process.env.HEIC_CONVERT_BIN = "/opt/heif-convert";
    expect(ffmpegBin()).toBe("/opt/ffmpeg");
    expect(ffprobeBin()).toBe("/opt/ffprobe");
    expect(heicConvertBin()).toBe("/opt/heif-convert");
  });

  it("نبودن فایل را missing و باینری نصب‌شده را ok گزارش می‌کند", async () => {
    process.env.FFMPEG_BIN = "/no/such/ffmpeg";
    process.env.FFPROBE_BIN = "/no/such/ffprobe";
    process.env.HEIC_CONVERT_BIN = "/no/such/heif-convert";
    expect(await checkMediaBins()).toEqual({
      ffmpeg: "missing",
      ffprobe: "missing",
      heicConvert: "missing",
    });
    delete process.env.FFMPEG_BIN;
    delete process.env.FFPROBE_BIN;
    delete process.env.HEIC_CONVERT_BIN;
    expect(await checkMediaBins()).toEqual({
      ffmpeg: "ok",
      ffprobe: "ok",
      heicConvert: "ok",
    });
  });
});
