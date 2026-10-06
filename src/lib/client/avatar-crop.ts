/** چیدمان برش مربعی آواتار: تصویر همیشه کادر را می‌پوشاند. */

export const AVATAR_CROP_VIEW = 280;
export const AVATAR_OUTPUT_SIZE = 512;

export type CropLayout = {
  scale: number;
  displayW: number;
  displayH: number;
  panX: number;
  panY: number;
};

export type CropSourceRect = {
  x: number;
  y: number;
  size: number;
};

function clamp(value: number, min: number, max: number) {
  const n = Math.min(max, Math.max(min, value));
  return n === 0 ? 0 : n;
}

export function avatarCropLayout(
  imgW: number,
  imgH: number,
  zoom: number,
  panX: number,
  panY: number,
  view = AVATAR_CROP_VIEW,
): CropLayout {
  const safeZoom = clamp(zoom, 1, 3);
  const base = Math.max(view / imgW, view / imgH);
  const scale = base * safeZoom;
  const displayW = imgW * scale;
  const displayH = imgH * scale;
  const maxPanX = Math.max(0, (displayW - view) / 2);
  const maxPanY = Math.max(0, (displayH - view) / 2);
  return {
    scale,
    displayW,
    displayH,
    panX: clamp(panX, -maxPanX, maxPanX),
    panY: clamp(panY, -maxPanY, maxPanY),
  };
}

/** ناحیهٔ منبع (پیکسل تصویر اصلی) که داخل کادر مربعی دیده می‌شود. */
export function avatarCropSourceRect(
  imgW: number,
  imgH: number,
  zoom: number,
  panX: number,
  panY: number,
  view = AVATAR_CROP_VIEW,
): CropSourceRect {
  const layout = avatarCropLayout(imgW, imgH, zoom, panX, panY, view);
  const x = ((layout.displayW - view) / 2 - layout.panX) / layout.scale;
  const y = ((layout.displayH - view) / 2 - layout.panY) / layout.scale;
  const size = view / layout.scale;
  const clampedX = clamp(x, 0, Math.max(0, imgW - 1));
  const clampedY = clamp(y, 0, Math.max(0, imgH - 1));
  const clampedSize = Math.min(size, imgW - clampedX, imgH - clampedY);
  return { x: clampedX, y: clampedY, size: clampedSize };
}
