"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { fa } from "@/lib/i18n/fa";
import { cn } from "@/lib/utils";
import { JalaliDateField } from "@/components/jalali/jalali-date-field";

export type RecurrenceState = {
  recurrenceType: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "CUSTOM";
  config: Record<string, unknown>;
};

type Props = {
  value: RecurrenceState;
  onChange: (next: RecurrenceState) => void;
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const TYPE_HELP: Record<RecurrenceState["recurrenceType"], string> = {
  ONCE: "فقط یک تاریخ مشخص",
  DAILY: "هر N روز",
  WEEKLY: "روزهای مشخص هفته",
  MONTHLY: "در هر ماه",
  CUSTOM: "فاصله سفارشی",
};

export function RecurrenceFields({ value, onChange }: Props) {
  const { recurrenceType, config } = value;

  function setType(t: RecurrenceState["recurrenceType"]) {
    const defaults: Record<string, Record<string, unknown>> = {
      ONCE: { date: "" },
      DAILY: { interval: 1, excludeWeekdays: [] },
      WEEKLY: { mode: "specific_days", weekdays: [2] },
      MONTHLY: { mode: "day_of_month", day: 1 },
      CUSTOM: { unit: "week", interval: 2, weekdays: [2] },
    };
    onChange({ recurrenceType: t, config: defaults[t]! });
  }

  function patch(partial: Record<string, unknown>) {
    onChange({ recurrenceType, config: { ...config, ...partial } });
  }

  function WeekdayToggle({
    list,
    onToggle,
    activeClass,
  }: {
    list: number[];
    onToggle: (next: number[]) => void;
    activeClass?: string;
  }) {
    return (
      <ToggleGroup
        type="multiple"
        dir="rtl"
        spacing={2}
        value={list.map(String)}
        onValueChange={(vals) => onToggle(vals.map(Number))}
        variant="outline"
        className="grid w-full grid-cols-4 gap-2 sm:grid-cols-7"
      >
        {WEEKDAYS.map((d) => (
          <ToggleGroupItem
            key={d}
            value={String(d)}
            className={cn(
              "h-10 w-full rounded-md border px-1 text-xs shadow-none",
              activeClass,
            )}
            aria-label={fa.weekdays[d]}
          >
            {fa.weekdays[d]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="space-y-2">
        <Label>نوع تکرار</Label>
        <RadioGroup
          value={recurrenceType}
          onValueChange={(v) =>
            setType(v as RecurrenceState["recurrenceType"])
          }
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {(
            Object.keys(fa.recurrence) as RecurrenceState["recurrenceType"][]
          ).map((k) => (
            <label
              key={k}
              className={cn(
                "border-border hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                recurrenceType === k && "border-primary bg-primary/5",
              )}
            >
              <RadioGroupItem value={k} className="mt-0.5" />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  {fa.recurrence[k]}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {TYPE_HELP[k]}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <input type="hidden" name="recurrenceType" value={recurrenceType} />
        <input
          type="hidden"
          name="recurrenceConfig"
          value={JSON.stringify(config)}
        />
      </div>

      {recurrenceType === "ONCE" ? (
        <JalaliDateField
          name="_onceDate"
          label="تاریخ اجرا"
          value={typeof config.date === "string" ? config.date : null}
          required
          onChange={(g) => patch({ date: g ?? "" })}
        />
      ) : null}

      {recurrenceType === "DAILY" ? (
        <>
          <div className="space-y-2">
            <Label>فاصله (روز)</Label>
            <Input
              type="number"
              min={1}
              value={Number(config.interval ?? 1)}
              onChange={(e) =>
                patch({ interval: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>روزهای حذف‌شده</Label>
            <WeekdayToggle
              list={
                Array.isArray(config.excludeWeekdays)
                  ? (config.excludeWeekdays as number[])
                  : []
              }
              onToggle={(next) => patch({ excludeWeekdays: next })}
              activeClass="data-[state=on]:bg-destructive/15 data-[state=on]:text-destructive"
            />
          </div>
        </>
      ) : null}

      {recurrenceType === "WEEKLY" ? (
        <>
          <div className="space-y-2">
            <Label>حالت</Label>
            <Select
              value={String(config.mode ?? "specific_days")}
              onValueChange={(v) => {
                if (v === "any_day_in_week") {
                  patch({ mode: "any_day_in_week" });
                } else {
                  patch({
                    mode: "specific_days",
                    weekdays: Array.isArray(config.weekdays)
                      ? config.weekdays
                      : [2],
                  });
                }
              }}
            >
              <SelectTrigger aria-label="حالت هفتگی">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specific_days">روزهای مشخص</SelectItem>
                <SelectItem value="any_day_in_week">
                  یک‌بار در طول هفته
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.mode !== "any_day_in_week" ? (
            <div className="space-y-2">
              <Label>روزهای هفته</Label>
              <WeekdayToggle
                list={
                  Array.isArray(config.weekdays)
                    ? (config.weekdays as number[])
                    : []
                }
                onToggle={(next) => patch({ weekdays: next })}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {recurrenceType === "MONTHLY" ? (
        <>
          <div className="space-y-2">
            <Label>حالت</Label>
            <Select
              value={String(config.mode ?? "day_of_month")}
              onValueChange={(mode) => {
                if (mode === "day_of_month") {
                  patch({ mode, day: Number(config.day ?? 1) });
                } else {
                  patch({ mode });
                }
              }}
            >
              <SelectTrigger aria-label="حالت ماهانه">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day_of_month">روز مشخص ماه</SelectItem>
                <SelectItem value="last_day">آخرین روز ماه</SelectItem>
                <SelectItem value="any_day_in_month">
                  یک‌بار در طول ماه
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.mode === "day_of_month" || !config.mode ? (
            <div className="space-y-2">
              <Label>روز ماه</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={Number(config.day ?? 1)}
                onChange={(e) =>
                  patch({
                    mode: "day_of_month",
                    day: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
          ) : null}
        </>
      ) : null}

      {recurrenceType === "CUSTOM" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>واحد</Label>
              <Select
                value={String(config.unit ?? "week")}
                onValueChange={(v) => patch({ unit: v })}
              >
                <SelectTrigger aria-label="واحد تکرار">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">روز</SelectItem>
                  <SelectItem value="week">هفته</SelectItem>
                  <SelectItem value="month">ماه</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>فاصله</Label>
              <Input
                type="number"
                min={1}
                value={Number(config.interval ?? 1)}
                onChange={(e) =>
                  patch({ interval: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
          </div>
          {config.unit === "week" || !config.unit ? (
            <div className="space-y-2">
              <Label>روزهای هفته</Label>
              <WeekdayToggle
                list={
                  Array.isArray(config.weekdays)
                    ? (config.weekdays as number[])
                    : []
                }
                onToggle={(next) => patch({ weekdays: next })}
              />
            </div>
          ) : null}
          {config.unit === "month" ? (
            <div className="space-y-2">
              <Label>روز ماه</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={Number(config.day ?? 1)}
                onChange={(e) =>
                  patch({
                    day: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
