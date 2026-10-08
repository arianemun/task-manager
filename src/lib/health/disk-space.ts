import fs from "node:fs";
import path from "node:path";
import { chatMediaDiskUsage, formatByteSize, uploadRoot } from "@/lib/chat/media-size";
import { toFaDigits } from "@/lib/utils";

export type DiskLevel = "ok" | "warn" | "critical";

export type DiskVolume = {
  id: "data" | "backups";
  title: string;
  freeBytes: number;
  totalBytes: number;
  freeRatio: number;
  level: DiskLevel;
};

export type DiskSection = {
  id: "database" | "uploads" | "chat_media" | "backups";
  title: string;
  bytes: number;
};

export type DiskSpaceReport = {
  volumes: DiskVolume[];
  sections: DiskSection[];
};

export function diskLevel(freeRatio: number): DiskLevel {
  if (freeRatio < 0.08) return "critical";
  if (freeRatio < 0.15) return "warn";
  return "ok";
}

export function formatFreeRatio(freeRatio: number): string {
  return `${toFaDigits(Math.round(freeRatio * 100))}٪`;
}

function resolvePath(envVal: string | undefined, fallback: string): string {
  const value = envVal ?? fallback;
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function databaseFile(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function directoryBytes(dir: string, skipTopLevel: string[] = []): number {
  if (!fs.existsSync(dir)) return 0;
  let bytes = 0;
  const walk = (current: string, top: boolean) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (top && skipTopLevel.includes(entry.name)) continue;
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs, false);
      else if (entry.isFile()) bytes += fs.statSync(abs).size;
    }
  };
  walk(dir, true);
  return bytes;
}

function volume(id: DiskVolume["id"], title: string, target: string): DiskVolume {
  const existing = fs.existsSync(target) ? target : path.dirname(target);
  const stat = fs.statfsSync(existing);
  const totalBytes = Number(stat.blocks) * Number(stat.bsize);
  const freeBytes = Number(stat.bavail) * Number(stat.bsize);
  const freeRatio = totalBytes > 0 ? freeBytes / totalBytes : 1;
  return { id, title, freeBytes, totalBytes, freeRatio, level: diskLevel(freeRatio) };
}

export function measureDiskSpace(): DiskSpaceReport {
  const dataDir = path.dirname(databaseFile());
  const backupDir = resolvePath(process.env.BACKUP_DIR, "./backups");
  const uploads = uploadRoot();
  const dbFile = databaseFile();
  let databaseBytes = 0;
  for (const candidate of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      databaseBytes += fs.statSync(candidate).size;
    }
  }
  return {
    volumes: [
      volume("data", "پوشه داده", dataDir),
      volume("backups", "پوشه بکاپ", backupDir),
    ],
    sections: [
      { id: "database", title: "دیتابیس", bytes: databaseBytes },
      { id: "uploads", title: "آپلودها", bytes: directoryBytes(uploads, ["chat"]) },
      { id: "chat_media", title: "رسانه چت", bytes: chatMediaDiskUsage(uploads).bytes },
      { id: "backups", title: "بکاپ‌ها", bytes: directoryBytes(backupDir) },
    ],
  };
}

export function formatDiskVolume(item: DiskVolume): string {
  return `${item.title}: ${formatByteSize(item.freeBytes)} آزاد از ${formatByteSize(item.totalBytes)} (${formatFreeRatio(item.freeRatio)})`;
}

export { formatByteSize };
