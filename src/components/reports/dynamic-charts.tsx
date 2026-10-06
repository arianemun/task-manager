"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/reports/empty-chart";

function sk(heightClass: string) {
  return function ChartLoading() {
    return <ChartSkeleton heightClass={heightClass} />;
  };
}

/** recharts فقط روی کلاینت و به‌صورت chunk جدا لود می‌شود */
export const TrendAreaChart = dynamic(
  () => import("@/components/reports/charts").then((m) => m.TrendAreaChart),
  { ssr: false, loading: sk("h-44 sm:h-56") },
);

export const StatusDonut = dynamic(
  () => import("@/components/reports/charts").then((m) => m.StatusDonut),
  { ssr: false, loading: sk("h-44 sm:h-56") },
);

export const HorizontalStaffBar = dynamic(
  () =>
    import("@/components/reports/charts").then((m) => m.HorizontalStaffBar),
  { ssr: false, loading: sk("h-48 sm:h-64") },
);

export const DepartmentGroupedBar = dynamic(
  () =>
    import("@/components/reports/charts").then((m) => m.DepartmentGroupedBar),
  { ssr: false, loading: sk("h-48 sm:h-64") },
);

export const TasksFailBar = dynamic(
  () => import("@/components/reports/charts").then((m) => m.TasksFailBar),
  { ssr: false, loading: sk("h-48 sm:h-64") },
);

export const WeekdayBars = dynamic(
  () => import("@/components/reports/charts").then((m) => m.WeekdayBars),
  { ssr: false, loading: sk("h-44 sm:h-56") },
);

export const HourHistogram = dynamic(
  () => import("@/components/reports/charts").then((m) => m.HourHistogram),
  { ssr: false, loading: sk("h-44 sm:h-56") },
);

export const ReasonsBar = dynamic(
  () => import("@/components/reports/charts").then((m) => m.ReasonsBar),
  { ssr: false, loading: sk("h-44 sm:h-56") },
);

export const CalendarHeatmap = dynamic(
  () => import("@/components/reports/charts").then((m) => m.CalendarHeatmap),
  { ssr: false, loading: sk("h-32 sm:h-40") },
);

export const StaffDayHeatmapGrid = dynamic(
  () =>
    import("@/components/reports/charts").then((m) => m.StaffDayHeatmapGrid),
  { ssr: false, loading: sk("h-40 sm:h-48") },
);
