export type SniffedMedia = {
  kind: "image" | "video";
  ext: "jpg" | "png" | "webp" | "mp4" | "webm";
};

export function sniffMedia(buf: Buffer): SniffedMedia | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { kind: "image", ext: "jpg" };
  }
  if (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { kind: "image", ext: "png" };
  }
  if (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { kind: "image", ext: "webp" };
  }
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    return { kind: "video", ext: "mp4" };
  }
  if (
    buf.length > 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  ) {
    return { kind: "video", ext: "webm" };
  }
  return null;
}
