import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function ffmpegBin(): string {
  return process.env.FFMPEG_BIN?.trim() || "ffmpeg";
}

export function ffprobeBin(): string {
  return process.env.FFPROBE_BIN?.trim() || "ffprobe";
}

export function heicConvertBin(): string {
  return process.env.HEIC_CONVERT_BIN?.trim() || "heif-convert";
}

/** GPS، مدل دستگاه و تاریخ ضبط در خروجی نمانند. */
export const STRIP_METADATA_ARGS = ["-map_metadata", "-1", "-map_chapters", "-1"];

export async function probeDurationMs(file: string): Promise<number> {
  const { stdout } = await execFileAsync(ffprobeBin(), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const seconds = Number(String(stdout).trim());
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0;
}

export const VIDEO_MAXRATE = "2.5M";
export const VIDEO_BUFSIZE = "5M";

type VideoProbe = {
  videoCodec: string | null;
  audioCodec: string | null;
  width: number;
  height: number;
  rotation: number;
  majorBrand: string;
  formatName: string;
};

export async function probeVideo(file: string): Promise<VideoProbe> {
  const { stdout } = await execFileAsync(ffprobeBin(), [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    file,
  ]);
  const data = JSON.parse(String(stdout)) as {
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      side_data_list?: Array<{ rotation?: number }>;
    }>;
    format?: { format_name?: string; tags?: Record<string, string> };
  };
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const audio = data.streams?.find((stream) => stream.codec_type === "audio");
  const rotation = Number(video?.side_data_list?.find((side) => typeof side.rotation === "number")?.rotation ?? 0);
  let width = Number(video?.width ?? 0);
  let height = Number(video?.height ?? 0);
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  return {
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    width,
    height,
    rotation,
    majorBrand: String(data.format?.tags?.major_brand ?? "").trim().toLowerCase(),
    formatName: String(data.format?.format_name ?? ""),
  };
}

function fits720p(width: number, height: number): boolean {
  return Math.max(width, height) <= 1280 && Math.min(width, height) <= 720;
}

function canRemux(probe: VideoProbe): boolean {
  const mp4 = probe.formatName.includes("mp4") && probe.majorBrand !== "qt";
  const audioOk = probe.audioCodec === null || probe.audioCodec === "aac";
  return probe.videoCodec === "h264" && audioOk && mp4 && fits720p(probe.width, probe.height);
}

export function videoEncodeArgs(input: string, output: string): string[] {
  return [
    "-y",
    "-i",
    input,
    "-vf",
    "scale='min(1280,iw)':-2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-maxrate",
    VIDEO_MAXRATE,
    "-bufsize",
    VIDEO_BUFSIZE,
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    ...STRIP_METADATA_ARGS,
    output,
  ];
}

/**
 * اگر ورودی از قبل H.264 و AAC و حداکثر 720p و داخل mp4 باشد فقط remux می‌شود.
 * در این حالت ماتریس چرخش می‌ماند چون `-c copy` آن را برنمی‌دارد.
 * در غیر این صورت encode است و `-noautorotate` عمداً نیست تا چرخش روی پیکسل نوشته شود.
 */
export async function transcodeVideoFile(input: string, output: string): Promise<void> {
  let probe: VideoProbe | null = null;
  try {
    probe = await probeVideo(input);
  } catch {
    probe = null;
  }
  if (probe && canRemux(probe)) {
    const args = ["-y", "-i", input, "-map", "0:v:0"];
    if (probe.audioCodec) args.push("-map", "0:a:0");
    args.push("-c", "copy", "-movflags", "+faststart", ...STRIP_METADATA_ARGS, output);
    await execFileAsync(ffmpegBin(), args);
    return;
  }
  await execFileAsync(ffmpegBin(), videoEncodeArgs(input, output));
}

export async function convertHeicToJpeg(input: string, output: string): Promise<void> {
  await execFileAsync(heicConvertBin(), ["--quiet", input, output]);
}

export async function transcodeImageFile(input: string, output: string): Promise<void> {
  await execFileAsync(ffmpegBin(), [
    "-y",
    "-i",
    input,
    "-vf",
    "scale='min(1920,iw)':-2",
    ...STRIP_METADATA_ARGS,
    output,
  ]);
}

export async function writeThumbnail(
  input: string,
  thumb: string,
  options?: { at?: string },
): Promise<void> {
  const args = ["-y"];
  if (options?.at) args.push("-ss", options.at);
  args.push(
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale='min(480,iw)':-2",
    ...STRIP_METADATA_ARGS,
    thumb,
  );
  await execFileAsync(ffmpegBin(), args);
}
