"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { toJalali } from "@/lib/dates";
import { EMPTY_RATE_HINT } from "@/lib/reports";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import type { loadMeReport } from "@/server/queries/me-report";

type Report = ReturnType<typeof loadMeReport>;

const chartConfig = {
  rate: { label: "درصد انجام", color: "var(--primary)" },
} satisfies ChartConfig;

export function ReportView({ data }: { data: Report }) {
  const chartData = data.bar30.map((b) => {
    const j = toJalali(b.date);
    return {
      label: j.jDate.slice(5),
      rate: b.rate ?? 0,
      hasData: b.rate != null,
    };
  });

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          label="انجام این هفته"
          value={
            data.weekStats.rate == null
              ? "—"
              : `${toFaDigits(data.weekStats.rate)}٪`
          }
          hint={data.weekStats.rate == null ? EMPTY_RATE_HINT : undefined}
        />
        <Kpi
          label="انجام این ماه"
          value={
            data.monthStats.rate == null
              ? "—"
              : `${toFaDigits(data.monthStats.rate)}٪`
          }
          hint={data.monthStats.rate == null ? EMPTY_RATE_HINT : undefined}
        />
        <Kpi
          label="در جریان این هفته"
          value={toFaDigits(data.weekRates.inProgress)}
        />
        <Kpi
          label="در جریان این ماه"
          value={toFaDigits(data.monthRates.inProgress)}
        />
        <Kpi label="انجام‌شده" value={toFaDigits(data.counts.done)} />
        <Kpi label="انجام‌نشده" value={toFaDigits(data.counts.notDone)} />
        <Kpi label="فراموش‌شده" value={toFaDigits(data.counts.missed)} />
        <Kpi label="streak فعلی" value={toFaDigits(data.streaks.current)} />
        <Kpi
          label="بهترین streak"
          value={toFaDigits(data.streaks.best)}
          className="col-span-2"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">۳۰ روز اخیر</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-48 w-full" dir="ltr">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9 }}
                tickFormatter={(v) => toFaDigits(String(v))}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 9 }}
                tickFormatter={(v) => toFaDigits(v)}
                width={28}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="tabular-nums">
                        {toFaDigits(Number(value))}٪
                      </span>
                    )}
                    labelFormatter={(l) => (
                      <span dir="rtl">{toFaDigits(String(l))}</span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="rate"
                fill="var(--color-rate)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">موارد انجام‌نشده / فراموش‌شده</h2>
        {data.recentProblems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="مورد انجام‌نشده‌ای نیست"
            description="عالی — همه چیز مرتب است"
            className="py-8"
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {data.recentProblems.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
              >
                <span className="min-w-0 truncate">{r.title}</span>
                <Badge
                  variant={r.status === "MISSED" ? "danger" : "warning"}
                  className="shrink-0"
                >
                  {fa.status[r.status as keyof typeof fa.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  className,
  hint,
}: {
  label: string;
  value: string;
  className?: string;
  hint?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="space-y-2">
        <p className="text-muted-foreground text-sm leading-[1.7]">{label}</p>
        <p className="text-kpi tabular-nums" data-kpi>
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
