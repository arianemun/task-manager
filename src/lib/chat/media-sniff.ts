export type SniffedMedia = {
  kind: "image" | "video";
  ext: "jpg" | "png" | "webp" | "heic" | "mp4" | "webm";
};

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "mif1", "msf1"]);

function ftypBrands(buf: Buffer): string[] {
  if (buf.length < 12 || buf.toString("ascii", 4, 8) !== "ftyp") return [];
  const boxSize = buf.readUInt32BE(0);
  const end = boxSize >= 16 ? Math.min(buf.length, boxSize) : buf.length;
  const brands = [buf.toString("ascii", 8, 12)];
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(buf.toString("ascii", offset, offset + 4));
  }
  return brands.map((brand) => brand.toLowerCase().replace(/\0/g, "").trim()).filter(Boolean);
}

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
  const brands = ftypBrands(buf);
  if (brands.length > 0) {
    if (brands.some((brand) => HEIC_BRANDS.has(brand))) return { kind: "image", ext: "heic" };
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
