"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { RecurrenceState } from "./recurrence-fields";

type PreviewItem = {
  jalali: string;
  weekday: string;
  isHoliday: boolean;
  isExcludedWeekday: boolean;
  periodStart: string;
};

type Props = {
  recurrence: RecurrenceState;
  startDate: string;
  endDate: string | null;
  skipHolidays: boolean;
};

export function OccurrencePreview({
  recurrence,
  startDate,
  endDate,
  skipHolidays,
}: Props) {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setItems([]);
      setWarning(null);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/internal/preview-occurrences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recurrenceType: recurrence.recurrenceType,
            recurrenceConfig: recurrence.config,
            startDate,
            endDate,
            skipHolidays,
            count: 10,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setItems([]);
          setWarning(json.error ?? "خطا در پیش‌نمایش");
          return;
        }
        setItems(json.periods ?? []);
        setWarning(json.warning ?? null);
      } catch {
        setWarning("خطا در پیش‌نمایش");
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [recurrence, startDate, endDate, skipHolidays]);

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">پیش‌نمایش ۱۰ تاریخ بعدی</h3>
        {loading ? (
          <span className="text-muted-foreground text-xs">در حال محاسبه…</span>
        ) : null}
      </div>
      {warning ? (
        <p className="text-destructive text-sm">{warning}</p>
      ) : null}
      <ol className="space-y-1.5 text-sm">
        {items.map((p) => (
          <li
            key={p.periodStart}
            className="flex flex-wrap items-center gap-2 border-b border-dashed py-1.5 last:border-0"
          >
            <span className="font-medium">{p.jalali}</span>
            <span className="text-muted-foreground">{p.weekday}</span>
            {p.isHoliday ? (
              <Badge variant="destructive" className="text-[10px]">
                تعطیل
              </Badge>
            ) : null}
            {p.isExcludedWeekday ? (
              <Badge variant="outline" className="text-[10px]">
                حذف‌شده
              </Badge>
            ) : null}
          </li>
        ))}
        {!loading && items.length === 0 && !warning ? (
          <li className="text-muted-foreground">—</li>
        ) : null}
      </ol>
    </div>
  );
}
