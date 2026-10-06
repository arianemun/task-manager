import type { StatusCounts } from "./rates";
import { ratesFromCounts } from "./rates";

/** ساخت StatusCounts از لیست وضعیت‌ها — منبع مشترک me و admin */
export function statusCountsFromList(statuses: readonly string[]): StatusCounts {
  const counts: StatusCounts = {};
  for (const s of statuses) {
    const key = s as keyof StatusCounts;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function ratesFromStatusList(statuses: readonly string[]) {
  return ratesFromCounts(statusCountsFromList(statuses));
}
