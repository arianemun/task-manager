import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("دکمه نمایش رمز", () => {
  it("فرم را ارسال نمی‌کند، برچسب فارسی دارد و فونت موبایل ۱۶px می‌ماند", () => {
    const button = source("src/components/ui/password-input.tsx");
    const input = source("src/components/ui/input.tsx");
    const login = source("src/components/auth/login-form.tsx");
    const change = source("src/components/auth/change-password-form.tsx");

    expect(button).toContain('type="button"');
    expect(button).toContain("fa.auth.showPassword");
    expect(button).toContain("fa.auth.hidePassword");
    expect(button).toContain('dir="ltr"');
    expect(button).toContain("end-0");
    expect(button).toContain("pe-11");
    expect(input).toMatch(/text-base\b/);
    expect(login).toContain('autoComplete="current-password"');
    expect(change).toContain('autoComplete="current-password"');
    expect(change).toContain('autoComplete="new-password"');
  });
});
