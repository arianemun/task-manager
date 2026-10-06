import type { ChartConfig } from "@/components/ui/chart";
import { fa } from "@/lib/i18n/fa";

/** رنگ وضعیت از توکن‌های CSS — سازگار با تم تاریک */
export const STATUS_CHART_COLORS: Record<string, string> = {
  DONE: "var(--status-done)",
  DONE_LATE: "var(--status-late)",
  NOT_DONE: "var(--status-not-done)",
  MISSED: "var(--status-missed)",
  PENDING: "var(--status-pending)",
  EXCUSED: "var(--status-excused)",
};

export const CHART_PRIMARY = "var(--primary)";

export const trendChartConfig = {
  rate: { label: "درصد انجام", color: "var(--primary)" },
  avg: { label: "میانگین", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

export const rateChartConfig = {
  rate: { label: "درصد", color: "var(--primary)" },
} satisfies ChartConfig;

export const statusChartConfig = {
  DONE: { label: fa.status.DONE, color: "var(--status-done)" },
  DONE_LATE: { label: fa.status.DONE_LATE, color: "var(--status-late)" },
  NOT_DONE: { label: fa.status.NOT_DONE, color: "var(--status-not-done)" },
  MISSED: { label: fa.status.MISSED, color: "var(--status-missed)" },
  PENDING: { label: fa.status.PENDING, color: "var(--status-pending)" },
  EXCUSED: { label: fa.status.EXCUSED, color: "var(--status-excused)" },
} satisfies ChartConfig;

export const deptStackChartConfig = {
  done: { label: "انجام", color: "var(--status-done)" },
  doneLate: { label: "تأخیر", color: "var(--status-late)" },
  notDone: { label: "انجام‌نشده", color: "var(--status-not-done)" },
  missed: { label: "فراموش", color: "var(--status-missed)" },
} satisfies ChartConfig;
