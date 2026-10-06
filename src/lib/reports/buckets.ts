import {
  startOfJalaliMonth,
  startOfJalaliWeek,
  toJalali,
  type GDate,
} from "@/lib/dates";
import { ratesFromCounts, type StatusCounts } from "./rates";

export type Granularity = "day" | "week" | "month";

export type DayAggregate = {
  day: GDate;
} & StatusCounts;

export type BucketPoint = {
  key: string;
  label: string;
  from: GDate;
  to: GDate;
  completionRate: number | null;
  onTimeRate: number | null;
  countable: number;
  done: number;
} & StatusCounts;

/**
 * تبدیل نتایج تجمیع‌شده روزانه (از SQL) به سطل هفته/ماه شمسی.
 * روی رکوردهای خام occurrence اجرا نشود.
 *
 * محور زمان نمودارها: چپ = قدیم‌تر، راست = جدیدتر (ltr-chronological).
 * ر.ک. lib/reports/time-axis.ts
 */
export function bucketDayAggregates(
  days: DayAggregate[],
  granularity: Granularity,
): BucketPoint[] {
  if (granularity === "day") {
    return [...days]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((d) => {
        const r = ratesFromCounts(d);
        const j = toJalali(d.day);
        return {
          key: d.day,
          label: j.jDate,
          from: d.day,
          to: d.day,
          completionRate: r.completionRate,
          onTimeRate: r.onTimeRate,
          countable: r.countable,
          done: r.done + r.doneLate,
          PENDING: d.PENDING,
          DONE: d.DONE,
          DONE_LATE: d.DONE_LATE,
          NOT_DONE: d.NOT_DONE,
          MISSED: d.MISSED,
          EXCUSED: d.EXCUSED,
        };
      });
  }

  const map = new Map<string, { from: GDate; to: GDate; counts: StatusCounts }>();

  for (const d of days) {
    const bucketStart =
      granularity === "week"
        ? startOfJalaliWeek(d.day)
        : startOfJalaliMonth(d.day);
    const key = bucketStart;
    const cur = map.get(key) ?? {
      from: bucketStart,
      to: d.day,
      counts: {},
    };
    cur.to = d.day > cur.to ? d.day : cur.to;
    for (const status of [
      "PENDING",
      "DONE",
      "DONE_LATE",
      "NOT_DONE",
      "MISSED",
      "EXCUSED",
    ] as const) {
      cur.counts[status] = (cur.counts[status] ?? 0) + (d[status] ?? 0);
    }
    map.set(key, cur);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const r = ratesFromCounts(v.counts);
      const j = toJalali(v.from);
      const label =
        granularity === "week"
          ? `هفته ${j.jDate}`
          : `${j.jy}/${String(j.jm).padStart(2, "0")}`;
      return {
        key,
        label,
        from: v.from,
        to: v.to,
        completionRate: r.completionRate,
        onTimeRate: r.onTimeRate,
        countable: r.countable,
        done: r.done + r.doneLate,
        ...v.counts,
      };
    });
}

export function averageCompletion(points: BucketPoint[]): number | null {
  const withRate = points.filter((p) => p.completionRate != null);
  if (withRate.length === 0) return null;
  const sum = withRate.reduce((a, p) => a + (p.completionRate ?? 0), 0);
  return Math.round(sum / withRate.length);
}
