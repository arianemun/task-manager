import { execFile } from "node:child_process";
import { ffmpegBin, ffprobeBin, heicConvertBin } from "@/lib/chat/transcode";

export type BinStatus = "ok" | "missing";

export type MediaBins = {
  ffmpeg: BinStatus;
  ffprobe: BinStatus;
  heicConvert: BinStatus;
};

function probeBin(bin: string, args: string[]): Promise<BinStatus> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 4000 }, (error) => {
      if ((error as NodeJS.ErrnoException | null)?.code === "ENOENT") resolve("missing");
      else resolve("ok");
    });
  });
}

export async function checkMediaBins(): Promise<MediaBins> {
  const [ffmpeg, ffprobe, heicConvert] = await Promise.all([
    probeBin(ffmpegBin(), ["-version"]),
    probeBin(ffprobeBin(), ["-version"]),
    probeBin(heicConvertBin(), ["--version"]),
  ]);
  return { ffmpeg, ffprobe, heicConvert };
}
