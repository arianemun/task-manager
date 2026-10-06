"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartSkeleton, EmptyChart } from "@/components/reports/empty-chart";
import { CHART_H, staffBarHeightPx } from "@/components/reports/chart-heights";
import { faNum, faPercent } from "@/components/reports/chart-format";
import {
  CHART_PRIMARY,
  STATUS_CHART_COLORS,
  trendChartConfig,
  statusChartConfig,
  rateChartConfig,
  deptStackChartConfig,
} from "@/components/reports/chart-theme";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

type ChartShellProps = {
  loading?: boolean;
  empty?: boolean;
  skeletonClass?: string;
  children: React.ReactNode;
};

function ChartShell({
  loading,
  empty,
  skeletonClass,
  children,
}: ChartShellProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (loading || !mounted) {
    return <ChartSkeleton className={skeletonClass} />;
  }
  if (empty) return <EmptyChart />;
  return <>{children}</>;
}

/** tooltip راست‌به‌چپ با ارقام فارسی؛ برچسب محور کامل (تاریخ جلالی بدون برش) */
function FaTooltip({
  config,
  valueKind = "num",
}: {
  config: ChartConfig;
  valueKind?: "num" | "percent";
}) {
  return (
    <ChartTooltip
      content={
        <ChartTooltipContent
          className="border-border bg-popover text-popover-foreground text-start shadow-md"
          formatter={(value, name) => {
            const missing = value == null || value === "";
            return (
            <div
              className="flex w-full items-center justify-between gap-4 text-start"
              dir="rtl"
            >
              <span className="text-muted-foreground">
                {config[String(name)]?.label ?? name}
              </span>
              <span className="font-medium tabular-nums">
                {missing
                  ? "کار ارزیابی‌شده‌ای نیست"
                  : valueKind === "percent"
                    ? faPercent(Number(value))
                    : faNum(Number(value))}
              </span>
            </div>
            );
          }}
          labelFormatter={(l) => (
            <span dir="rtl" className="font-medium">
              {toFaDigits(String(l))}
            </span>
          )}
        />
      }
    />
  );
}

function MobileAwareLegend({
  nameKey,
  className,
}: {
  nameKey?: string;
  className?: string;
}) {
  const isMobile = useIsMobile();
  return (
    <ChartLegend
      verticalAlign="bottom"
      align="center"
      layout="horizontal"
      wrapperStyle={
        isMobile
          ? { paddingTop: 8, width: "100%" }
          : { paddingTop: 4 }
      }
      content={
        <ChartLegendContent
          nameKey={nameKey}
          className={
            className ??
            "flex max-w-full flex-wrap justify-center gap-x-3 gap-y-1"
          }
        />
      }
    />
  );
}

type TrendProps = {
  data: Array<{
    label: string;
    completionRate: number | null;
    average?: number | null;
  }>;
  average: number | null;
  loading?: boolean;
};

export function TrendAreaChart({ data, average, loading }: TrendProps) {
  const isMobile = useIsMobile();
  return (
    <ChartShell loading={loading} empty={!loading && data.length === 0}>
      {(() => {
        const rows = data.map((d) => ({
          ...d,
          rate: d.completionRate,
          avg: average,
        }));
        const config = trendChartConfig;
        return (
          <ChartContainer
            config={config}
            className={`report-chart ${CHART_H.sm}`}
            dir="ltr"
          >
            <AreaChart data={rows} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: isMobile ? 9 : 10 }}
                minTickGap={isMobile ? 48 : 24}
                interval={isMobile ? "preserveStartEnd" : "preserveEnd"}
                tickFormatter={(v) => {
                  const s = String(v);
                  return toFaDigits(isMobile ? s.slice(-5) : s);
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                width={isMobile ? 28 : 36}
                tickFormatter={(v) => faNum(v)}
              />
              <FaTooltip config={config} valueKind="percent" />
              <MobileAwareLegend />
              <Area
                type="monotone"
                dataKey="rate"
                name="rate"
                stroke="var(--color-rate)"
                fill="var(--color-rate)"
                fillOpacity={0.25}
                connectNulls={false}
                className="chart-series-primary"
              />
              {average != null ? (
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="avg"
                  stroke="var(--color-avg)"
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                  className="chart-series-avg"
                />
              ) : null}
            </AreaChart>
          </ChartContainer>
        );
      })()}
    </ChartShell>
  );
}

export function StatusDonut({
  counts,
  loading,
}: {
  counts: Record<string, number | undefined>;
  loading?: boolean;
}) {
  const isMobile = useIsMobile();
  const data = Object.entries(counts)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([status, value]) => ({
      status,
      name: fa.status[status as keyof typeof fa.status] ?? status,
      value: value ?? 0,
      fill: STATUS_CHART_COLORS[status] ?? CHART_PRIMARY,
    }));
  return (
    <ChartShell loading={loading} empty={!loading && data.length === 0}>
      <ChartContainer
        config={statusChartConfig}
        className={`report-chart ${CHART_H.sm}`}
        dir="ltr"
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="status"
            innerRadius={isMobile ? 36 : 50}
            outerRadius={isMobile ? 60 : 80}
          >
            {data.map((d) => (
              <Cell
                key={d.status}
                fill={d.fill}
                className={`chart-slice chart-slice-${d.status.toLowerCase()}`}
              />
            ))}
          </Pie>
          <FaTooltip config={statusChartConfig} />
          <MobileAwareLegend nameKey="status" />
        </PieChart>
      </ChartContainer>
    </ChartShell>
  );
}

const STAFF_DEFAULT_TOP = 10;

export function HorizontalStaffBar({
  data,
  loading,
}: {
  data: Array<{ fullName: string; completionRate: number | null }>;
  loading?: boolean;
}) {
  const isMobile = useIsMobile();
  const [showAll, setShowAll] = React.useState(false);
  const truncated = data.length > STAFF_DEFAULT_TOP && !showAll;
  const visible = truncated ? data.slice(0, STAFF_DEFAULT_TOP) : data;
  const rows = visible.map((d) => ({
    name: d.fullName,
    rate: d.completionRate,
  }));
  const height = staffBarHeightPx(rows.length || 1, isMobile);
  const config = rateChartConfig;

  return (
    <ChartShell loading={loading} empty={!loading && data.length === 0}>
      <div className="space-y-2">
        <ChartContainer
          config={config}
          className="report-chart aspect-auto w-full"
          style={{ height }}
          dir="ltr"
        >
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => faNum(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={isMobile ? 72 : 100}
              tick={{ fontSize: isMobile ? 9 : 10 }}
            />
            <FaTooltip config={config} valueKind="percent" />
            <Bar
              dataKey="rate"
              name="rate"
              fill="var(--color-rate)"
              radius={4}
              className="chart-series-primary"
            />
          </BarChart>
        </ChartContainer>
        {data.length > STAFF_DEFAULT_TOP ? (
          <div className="print:hidden flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "نمایش ۱۰ نفر برتر"
                : `نمایش همه (${toFaDigits(data.length)})`}
            </Button>
          </div>
        ) : null}
      </div>
    </ChartShell>
  );
}

export function DepartmentGroupedBar({
  data,
  loading,
}: {
  data: Array<{
    name: string;
    done: number;
    doneLate: number;
    notDone: number;
    missed: number;
  }>;
  loading?: boolean;
}) {
  const isMobile = useIsMobile();
  const config = deptStackChartConfig;
  return (
    <ChartShell loading={loading} empty={!loading && data.length === 0}>
      <ChartContainer
        config={config}
        className={`report-chart ${CHART_H.md}`}
        dir="ltr"
      >
        <BarChart data={data} margin={{ bottom: isMobile ? 8 : 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: isMobile ? 9 : 10 }}
            minTickGap={isMobile ? 28 : 12}
            interval={isMobile ? "preserveStartEnd" : 0}
          />
          <YAxis
            width={isMobile ? 28 : 36}
            tickFormatter={(v) => faNum(v)}
          />
          <FaTooltip config={config} />
          <MobileAwareLegend />
          <Bar
            dataKey="done"
            name="done"
            stackId="a"
            fill="var(--color-done)"
            className="chart-series-done"
          />
          <Bar
            dataKey="doneLate"
            name="doneLate"
            stackId="a"
            fill="var(--color-doneLate)"
            className="chart-series-late"
          />
          <Bar
            dataKey="notDone"
            name="notDone"
            stackId="a"
            fill="var(--color-notDone)"
            className="chart-series-not-done"
          />
          <Bar
            dataKey="missed"
            name="missed"
            stackId="a"
            fill="var(--color-missed)"
            className="chart-series-missed"
          />
        </BarChart>
      </ChartContainer>
    </ChartShell>
  );
}

export function TasksFailBar({
  data,
  loading,
}: {
  data: Array<{ title: string; fail: number }>;
  loading?: boolean;
}) {
  const isMobile = useIsMobile();
  const rows = data.slice(0, 12).map((d) => ({
    name: d.title.length > (isMobile ? 12 : 18)
      ? d.title.slice(0, isMobile ? 12 : 18) + "…"
      : d.title,
    fullName: d.title,
    fail: d.fail,
  }));
  const config = {
    fail: { label: "عدم انجام", color: "var(--status-not-done)" },
  } satisfies ChartConfig;
  return (
    <ChartShell loading={loading} empty={!loading && data.length === 0}>
      <ChartContainer
        config={config}
        className={`report-chart ${CHART_H.md}`}
        dir="ltr"
      >
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9 }}
            interval={isMobile ? "preserveStartEnd" : 0}
            minTickGap={isMobile ? 36 : 8}
            angle={isMobile ? -35 : -25}
            textAnchor="end"
            height={isMobile ? 64 : 70}
          />
          <YAxis
            width={isMobile ? 28 : 36}
            tickFormatter={(v) => faNum(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="border-border bg-popover text-popover-foreground text-start"
                labelFormatter={(_, payload) => {
                  const full = payload?.[0]?.payload?.fullName;
                  return (
                    <span dir="rtl">
                      {toFaDigits(String(full ?? ""))}
                    </span>
                  );
                }}
                formatter={(value) => (
                  <div
                    className="flex w-full justify-between gap-4"
                    dir="rtl"
                  >
                    <span className="text-muted-foreground">عدم انجام</span>
                    <span className="font-medium tabular-nums">
                      {faNum(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="fail"
            name="fail"
            fill="var(--color-fail)"
            className="chart-series-not-done"
          />
        </BarChart>
      </ChartContainer>
    </ChartShell>
  );
}

export function WeekdayBars({
  data,
  loading,
}: {
  data: Array<{ weekday: number; completionRate: number | null }>;
  loading?: boolean;
}) {
  const empty = data.every((d) => d.completionRate == null);
  const rows = data.map((d) => ({
    name: fa.weekdays[d.weekday as keyof typeof fa.weekdays],
    rate: d.completionRate,
  }));
  const config = rateChartConfig;
  return (
    <ChartShell loading={loading} empty={!loading && empty}>
      <ChartContainer
        config={config}
        className={`report-chart ${CHART_H.sm}`}
        dir="ltr"
      >
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis
            domain={[0, 100]}
            width={32}
            tickFormatter={(v) => faNum(v)}
          />
          <FaTooltip config={config} valueKind="percent" />
          <Bar
            dataKey="rate"
            name="rate"
            fill="var(--color-rate)"
            className="chart-series-primary"
          />
        </BarChart>
      </ChartContainer>
    </ChartShell>
  );
}

export function HourHistogram({
  data,
  loading,
}: {
  data: Array<{ hour: number; count: number }>;
  loading?: boolean;
}) {
  const isMobile = useIsMobile();
  const empty = data.every((d) => d.count === 0);
  const rows = data.map((d) => ({
    name: toFaDigits(String(d.hour).padStart(2, "0")),
    count: d.count,
  }));
  const config = {
    count: { label: "تعداد ثبت", color: CHART_PRIMARY },
  } satisfies ChartConfig;
  return (
    <ChartShell loading={loading} empty={!loading && empty}>
      <ChartContainer
        config={config}
        className={`report-chart ${CHART_H.sm}`}
        dir="ltr"
      >
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9 }}
            minTickGap={isMobile ? 20 : 8}
            interval={isMobile ? "preserveStartEnd" : 0}
          />
          <YAxis
            width={32}
            tickFormatter={(v) => faNum(v)}
          />
          <FaTooltip config={config} />
          <Bar
            dataKey="count"
            name="count"
            fill="var(--color-count)"
            className="chart-series-primary"
          />
        </BarChart>
      </ChartContainer>
    </ChartShell>
  );
}

export function ReasonsBar({
  data,
  loading,
}: {
  data: Array<{ reasonCode: string | null; reasonLabel?: string | null; c: number }>;
  loading?: boolean;
}) {
  const isMobile = useIsMobile();
  const rows = data.map((d) => ({
    name: d.reasonLabel ?? d.reasonCode ?? "—",
    c: Number(d.c),
  }));
  const config = {
    c: { label: "تعداد", color: "var(--status-not-done)" },
  } satisfies ChartConfig;
  return (
    <ChartShell loading={loading} empty={!loading && data.length === 0}>
      <ChartContainer
        config={config}
        className={`report-chart ${CHART_H.sm}`}
        dir="ltr"
      >
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            minTickGap={isMobile ? 24 : 8}
            interval={isMobile ? "preserveStartEnd" : 0}
          />
          <YAxis width={32} tickFormatter={(v) => faNum(v)} />
          <FaTooltip config={config} />
          <Bar
            dataKey="c"
            name="c"
            fill="var(--color-c)"
            className="chart-series-not-done"
          />
        </BarChart>
      </ChartContainer>
    </ChartShell>
  );
}

function heatTone(r: number | null | undefined): string {
  if (r == null) return "heat-none bg-muted";
  if (r >= 80) return "heat-high bg-status-done";
  if (r >= 50) return "heat-mid bg-status-late";
  return "heat-low bg-status-not-done";
}

function HeatLegend() {
  return (
    <div
      className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs"
      aria-label="راهنمای رنگ"
    >
      <span className="flex items-center gap-1.5">
        <span className="heat-high size-3 rounded-sm bg-status-done" />
        ≥۸۰٪
      </span>
      <span className="flex items-center gap-1.5">
        <span className="heat-mid size-3 rounded-sm bg-status-late" />
        ۵۰–۷۹٪
      </span>
      <span className="flex items-center gap-1.5">
        <span className="heat-low size-3 rounded-sm bg-status-not-done" />
        &lt;۵۰٪
      </span>
      <span className="flex items-center gap-1.5">
        <span className="heat-none size-3 rounded-sm bg-muted" />
        بدون داده
      </span>
    </div>
  );
}

function HeatCell({
  label,
  rate,
}: {
  label: string;
  rate: number | null | undefined;
}) {
  const text =
    rate == null
      ? `${label}: —`
      : `${label}: ${toFaDigits(rate)}٪`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`size-5 shrink-0 rounded-sm ${heatTone(rate)} focus-visible:ring-ring touch-manipulation focus-visible:ring-2 focus-visible:outline-none`}
          aria-label={text}
        />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="bg-popover text-popover-foreground w-auto max-w-[220px] px-3 py-2 text-sm"
      >
        <p dir="rtl">{text}</p>
      </PopoverContent>
    </Popover>
  );
}

export function CalendarHeatmap({
  days,
  loading,
}: {
  days: Array<{ day: string; rate: number | null }>;
  loading?: boolean;
}) {
  return (
    <ChartShell
      loading={loading}
      empty={!loading && days.length === 0}
      skeletonClass="h-32"
    >
      <div className="space-y-3">
        <HeatLegend />
        <div className="overflow-x-auto">
          <div className="flex min-w-max flex-wrap gap-1">
            {days.map((d) => (
              <HeatCell
                key={d.day}
                label={toFaDigits(d.day)}
                rate={d.rate}
              />
            ))}
          </div>
        </div>
      </div>
    </ChartShell>
  );
}

export function StaffDayHeatmapGrid({
  cells,
  loading,
}: {
  cells: Array<{ fullName: string; day: string; rate: number | null }>;
  loading?: boolean;
}) {
  const staff = [...new Set(cells.map((c) => c.fullName))].slice(0, 12);
  const days = [...new Set(cells.map((c) => c.day))].sort().slice(-21);
  const map = new Map(cells.map((c) => [`${c.fullName}:${c.day}`, c.rate]));

  return (
    <ChartShell
      loading={loading}
      empty={!loading && cells.length === 0}
      skeletonClass="h-40"
    >
      <div className="space-y-3">
        <HeatLegend />
        <div className="overflow-x-auto">
          <table className="w-max border-separate border-spacing-0 text-xs tabular-nums">
            <thead>
              <tr>
                <th className="bg-background sticky start-0 z-20 p-1" />
                {days.map((d) => (
                  <th key={d} className="p-0.5 font-normal">
                    {toFaDigits(d.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((name) => (
                <tr key={name}>
                  <td className="bg-background sticky start-0 z-10 max-w-24 truncate p-1 text-start font-medium">
                    {name}
                  </td>
                  {days.map((d) => {
                    const r = map.get(`${name}:${d}`);
                    return (
                      <td key={d} className="p-0.5">
                        <HeatCell
                          label={`${name} · ${toFaDigits(d)}`}
                          rate={r}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartShell>
  );
}
