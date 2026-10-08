import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyNewFiles, UPLOAD_ZIP_EXCLUDES } from "./uploads";

describe("بکاپ آپلود", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  function temp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tm-backup-"));
    dirs.push(dir);
    return dir;
  }

  it("zip روزانه رسانهٔ چت را برنمی‌دارد", () => {
    const root = temp();
    fs.mkdirSync(path.join(root, "chat", "1"), { recursive: true });
    fs.mkdirSync(path.join(root, "avatars", "2"), { recursive: true });
    fs.writeFileSync(path.join(root, "chat", "1", "a.jpg"), "chat");
    fs.writeFileSync(path.join(root, "avatars", "2", "b.jpg"), "avatar");
    const zipPath = path.join(root, "uploads.zip");
    execFileSync("zip", ["-r", zipPath, ".", "-x", ...UPLOAD_ZIP_EXCLUDES], { cwd: root });
    const list = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
    expect(list).toContain("avatars/2/b.jpg");
    expect(list).not.toContain("chat/1/a.jpg");
  });

  it("فقط فایل‌هایی را کپی می‌کند که در مقصد نیستند", () => {
    const source = temp();
    const dest = temp();
    fs.mkdirSync(path.join(source, "1"), { recursive: true });
    fs.writeFileSync(path.join(source, "1", "new.jpg"), "new");
    fs.writeFileSync(path.join(source, "1", "old.jpg"), "old");
    fs.mkdirSync(path.join(dest, "1"), { recursive: true });
    fs.writeFileSync(path.join(dest, "1", "old.jpg"), "already");
    const first = copyNewFiles(source, dest);
    expect(first).toEqual({ copied: 1, skipped: 1 });
    expect(fs.readFileSync(path.join(dest, "1", "old.jpg"), "utf8")).toBe("already");
    expect(fs.readFileSync(path.join(dest, "1", "new.jpg"), "utf8")).toBe("new");
    expect(copyNewFiles(source, dest)).toEqual({ copied: 0, skipped: 2 });
  });
});
