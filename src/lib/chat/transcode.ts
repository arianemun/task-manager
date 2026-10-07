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

/**
 * ویدیو را به H.264/AAC تبدیل می‌کند.
 * `-noautorotate` عمداً نیست: ffmpeg چرخش iPhone را روی پیکسل می‌نویسد
 * و بعد پرچم‌های متادیتا ماتریس نمایش را برمی‌دارند.
 */
export async function transcodeVideoFile(input: string, output: string): Promise<void> {
  await execFileAsync(ffmpegBin(), [
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
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    ...STRIP_METADATA_ARGS,
    output,
  ]);
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
