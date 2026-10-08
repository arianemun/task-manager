import fs from "node:fs";
import path from "node:path";
import { toFaDigits } from "@/lib/utils";

export function uploadRoot(override?: string): string {
  const dir = override ?? process.env.UPLOAD_DIR ?? "./uploads";
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

export function chatMediaDiskUsage(root = uploadRoot()): { bytes: number; files: number } {
  const dir = path.join(root, "chat");
  let bytes = 0;
  let files = 0;
  if (!fs.existsSync(dir)) return { bytes, files };
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) {
        bytes += fs.statSync(abs).size;
        files += 1;
      }
    }
  };
  walk(dir);
  return { bytes, files };
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${toFaDigits(bytes)} بایت`;
  const units = ["کیلوبایت", "مگابایت", "گیگابایت"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 0; index < units.length; index += 1) {
    unit = units[index];
    if (value < 1024 || index === units.length - 1) break;
    value /= 1024;
  }
  const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${toFaDigits(rounded)} ${unit}`;
}
