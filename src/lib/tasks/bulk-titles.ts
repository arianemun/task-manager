import { normalizePersianText } from "@/lib/validation/normalize";
import { toEnDigits } from "@/lib/utils";

export type PreparedTitle = {
  title: string;
  normalized: string;
  duplicateOfActive: boolean;
};

/** عنوان ذخیره‌شونده: یکسان‌سازی حروف و فاصله، بدون پایین آوردن حروف لاتین */
export function displayTaskTitle(line: string): string {
  return toEnDigits(line)
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0643/g, "\u06A9")
    .replace(/[\u200B\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function prepareBulkTitles(
  text: string,
  activeTitles: readonly string[] = [],
): PreparedTitle[] {
  const active = new Set(activeTitles.map((title) => normalizePersianText(title)));
  const seen = new Set<string>();
  const out: PreparedTitle[] = [];
  for (const line of text.split(/\r?\n/)) {
    const title = displayTaskTitle(line);
    if (!title) continue;
    const normalized = normalizePersianText(title);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({
      title,
      normalized,
      duplicateOfActive: active.has(normalized),
    });
  }
  return out;
}
