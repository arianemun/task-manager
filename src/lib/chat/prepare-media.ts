import { CHAT_IMAGE_MAX_BYTES, CHAT_VIDEO_MAX_BYTES, CHAT_VIDEO_MAX_MS } from "./types";

export class MediaPrepareError extends Error {}

function videoDurationMs(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration * 1000 : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new MediaPrepareError("ویدیو خوانده نشد"));
    };
    video.src = url;
  });
}

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1920;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new MediaPrepareError("فشرده‌سازی عکس ممکن نشد");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) throw new MediaPrepareError("فشرده‌سازی عکس ممکن نشد");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export async function prepareChatFile(file: File): Promise<{ file: File; kind: "image" | "video" }> {
  if (file.type.startsWith("image/")) {
    const compressed = await compressImage(file);
    if (compressed.size > CHAT_IMAGE_MAX_BYTES) {
      throw new MediaPrepareError("حجم عکس بعد از فشرده‌سازی هنوز زیاد است");
    }
    return { file: compressed, kind: "image" };
  }
  if (file.type.startsWith("video/")) {
    if (file.size > CHAT_VIDEO_MAX_BYTES) {
      throw new MediaPrepareError("حجم ویدیو حداکثر ۱۰۰ مگابایت است");
    }
    const duration = await videoDurationMs(file);
    if (duration > CHAT_VIDEO_MAX_MS) {
      throw new MediaPrepareError("ویدیو حداکثر ۵ دقیقه است");
    }
    return { file, kind: "video" };
  }
  throw new MediaPrepareError("فقط عکس یا ویدیو مجاز است");
}
