/** کوچک‌سازی تصویر سمت کلاینت — حداکثر عرض ۱۶۰۰px */
export async function resizeImageFile(
  file: File,
  maxWidth = 1600,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width <= maxWidth) return file;
    const scale = maxWidth / bitmap.width;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const mime =
      file.type === "image/png"
        ? "image/png"
        : file.type === "image/webp"
          ? "image/webp"
          : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mime, 0.85),
    );
    if (!blob) return file;
    return new File([blob], file.name, { type: mime, lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
