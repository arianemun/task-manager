import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarHeatmap,
  DepartmentGroupedBar,
  HorizontalStaffBar,
  HourHistogram,
  ReasonsBar,
  StaffDayHeatmapGrid,
  StatusDonut,
  TasksFailBar,
  TrendAreaChart,
  WeekdayBars,
} from "@/components/reports/dynamic-charts";
import { DetailsDataTable } from "@/components/reports/details-data-table";
import { ReportFiltersBar } from "@/components/reports/report-filters";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { REPORT_TABS } from "@/components/reports/report-tab-defs";
import { ReportTabsNav } from "@/components/reports/report-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ratesFromCounts } from "@/lib/reports";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toJalali } from "@/lib/dates";
import type { ReportFilters } from "@/lib/reports";
import { CHART_TIME_AXIS } from "@/lib/reports";
import { toFaDigits } from "@/lib/utils";
import type {
  aggregateByDepartment,
  aggregateByStaff,
  aggregateByDay,
  aggregateCompletionHours,
  aggregateReasons,
  aggregateStatusDonut,
  aggregateWeekdayRates,
  aggregateWorstTasks,
  listOccurrenceDetails,
  staffDayHeatmap,
} from "@/server/queries/admin-reports";

type Opt = { id: number; name: string; fullName?: string };

type Props = {
  filters: ReportFilters;
  basePath: string;
  departments: Opt[];
  staffOptions: Opt[];
  categories: Opt[];
  showDepartment?: boolean;
  lockUserId?: number | null;
  canExport: boolean;
  day: ReturnType<typeof aggregateByDay>;
  donut: ReturnType<typeof aggregateStatusDonut>;
  staff: ReturnType<typeof aggregateByStaff>;
  departmentsData: ReturnType<typeof aggregateByDepartment>;
  tasks: ReturnType<typeof aggregateWorstTasks>;
  weekdays: ReturnType<typeof aggregateWeekdayRates>;
  hours: ReturnType<typeof aggregateCompletionHours>;
  reasons: ReturnType<typeof aggregateReasons>;
  heatmap: ReturnType<typeof staffDayHeatmap>;
  details: ReturnType<typeof listOccurrenceDetails>;
};

function tabHref(
  base: string,
  filters: ReportFilters,
  tab: string,
  extra?: Record<string, string>,
) {
  const p = new URLSearchParams();
  p.set("tab", tab);
  p.set("range", filters.shortcut);
  if (filters.shortcut === "custom") {
    p.set("from", filters.from);
    p.set("to", filters.to);
  }
  if (filters.departmentId)
    p.set("departmentId", String(filters.departmentId));
  if (filters.userId) p.set("userId", String(filters.userId));
  if (filters.categoryId) p.set("categoryId", String(filters.categoryId));
  if (filters.recurrenceType) p.set("recurrenceType", filters.recurrenceType);
  if (filters.priority) p.set("priority", filters.priority);
  if (filters.q) p.set("q", filters.q);
  p.set("g", filters.granularity);
  if (filters.staffSort !== "rate_desc") p.set("staffSort", filters.staffSort);
  if (extra) for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return `${base}?${p.toString()}`;
}

function ChartCard({
  title,
  description,
  children,
  headerRight,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  return (
    <Card className="report-chart-card">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {headerRight}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ReportShell(props: Props) {
  const {
    filters,
    basePath,
    day,
    donut,
    staff,
    departmentsData,
    tasks,
    weekdays,
    hours,
    reasons,
    heatmap,
    details,
  } = props;
  const jFrom = toJalali(filters.from);
  const jTo = toJalali(filters.to);
  const rates = donut.rates;
  const activeTab =
    !filters.tab || filters.tab === "report" ? "summary" : filters.tab;

  const hrefForTab = Object.fromEntries(
    REPORT_TABS.map((t) => [t.id, tabHref(basePath, filters, t.id)]),
  );

  const exportQs = tabHref(basePath, filters, filters.tab).split("?")[1] ?? "";

  return (
    <div className="report-print-root flex flex-col gap-6 md:gap-8">
      <ReportPageHeader
        description={
          <>
            بازه: {toFaDigits(jFrom.jDate)} تا {toFaDigits(jTo.jDate)}
            <span className="mx-2">·</span>
            محور زمان: قدیم←جدید ({CHART_TIME_AXIS})
          </>
        }
        canExport={props.canExport}
        exportHref={`/api/export/reports?${exportQs}`}
      />

      <ReportFiltersBar
        filters={filters}
        departments={props.departments}
        staff={props.staffOptions}
        categories={props.categories}
        showDepartment={props.showDepartment}
        lockUserId={props.lockUserId}
      />

      <ReportTabsNav activeTab={activeTab} hrefForTab={hrefForTab} />

      {activeTab === "summary" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="درصد انجام"
              value={
                rates.completionRate == null
                  ? "—"
                  : `${toFaDigits(rates.completionRate)}٪`
              }
            />
            <Kpi
              label="به‌موقع"
              value={
                rates.onTimeRate == null
                  ? "—"
                  : `${toFaDigits(rates.onTimeRate)}٪`
              }
            />
            <Kpi label="قابل شمارش" value={toFaDigits(rates.countable)} />
            <Kpi label="کل occurrence" value={toFaDigits(rates.total)} />
          </div>
          <ChartCard
            title="روند درصد انجام"
            description={
              <>
                میانگین:{" "}
                {day.average == null ? "—" : `${toFaDigits(day.average)}٪`}
              </>
            }
            headerRight={
              <div className="print:hidden flex gap-1">
                {(["day", "week", "month"] as const).map((g) => (
                  <Button
                    key={g}
                    asChild
                    size="sm"
                    variant={filters.granularity === g ? "default" : "outline"}
                  >
                    <Link href={tabHref(basePath, filters, "summary", { g })}>
                      {g === "day"
                        ? "روزانه"
                        : g === "week"
                          ? "هفتگی"
                          : "ماهانه"}
                    </Link>
                  </Button>
                ))}
              </div>
            }
          >
            <TrendAreaChart data={day.buckets} average={day.average} />
          </ChartCard>
          <ChartCard title="توزیع وضعیت">
            <StatusDonut counts={donut.counts} />
          </ChartCard>
        </div>
      )}

      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="print:hidden flex flex-wrap gap-2">
            {(
              [
                ["rate_desc", "بیشترین درصد"],
                ["rate_asc", "کمترین درصد"],
                ["name", "نام"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                asChild
                size="sm"
                variant={filters.staffSort === k ? "default" : "outline"}
              >
                <Link
                  href={tabHref(basePath, filters, "staff", { staffSort: k })}
                >
                  {label}
                </Link>
              </Button>
            ))}
          </div>
          <ChartCard title="رتبه‌بندی">
            <HorizontalStaffBar data={staff} />
          </ChartCard>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-start">
                  <th className="p-2">پرسنل</th>
                  <th className="p-2">کل</th>
                  <th className="p-2">انجام</th>
                  <th className="p-2">تأخیر</th>
                  <th className="p-2">انجام‌نشده</th>
                  <th className="p-2">فراموش</th>
                  <th className="p-2">درصد</th>
                  <th className="p-2">بهترین streak</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.userId} className="border-t">
                    <td className="p-2">
                      <Link
                        className="text-primary underline"
                        href={`/admin/staff/${s.userId}?tab=summary&range=${filters.shortcut}${filters.shortcut === "custom" ? `&from=${filters.from}&to=${filters.to}` : ""}`}
                      >
                        {s.fullName}
                      </Link>
                    </td>
                    <td className="p-2">{toFaDigits(s.total)}</td>
                    <td className="p-2">{toFaDigits(s.done)}</td>
                    <td className="p-2">{toFaDigits(s.doneLate)}</td>
                    <td className="p-2">{toFaDigits(s.notDone)}</td>
                    <td className="p-2">{toFaDigits(s.missed)}</td>
                    <td className="p-2">
                      {s.completionRate == null
                        ? "—"
                        : `${toFaDigits(s.completionRate)}٪`}
                    </td>
                    <td className="p-2">{toFaDigits(s.bestStreak)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "departments" && (
        <ChartCard title="مقایسه دپارتمان‌ها">
          <DepartmentGroupedBar data={departmentsData} />
        </ChartCard>
      )}

      {activeTab === "tasks" && (
        <ChartCard title="بیشترین عدم انجام">
          <TasksFailBar data={tasks} />
        </ChartCard>
      )}

      {activeTab === "patterns" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="هیت‌مپ تقویمی">
            <CalendarHeatmap
              days={day.dayAggs.map((d) => ({
                day: d.day,
                rate: ratesFromCounts(d).completionRate,
              }))}
            />
          </ChartCard>
          <ChartCard title="پرسنل × روز">
            <StaffDayHeatmapGrid cells={heatmap} />
          </ChartCard>
          <ChartCard title="روزهای هفته">
            <WeekdayBars data={weekdays} />
          </ChartCard>
          <ChartCard title="ساعت ثبت (تهران)">
            <HourHistogram data={hours} />
          </ChartCard>
        </div>
      )}

      {activeTab === "reasons" && (
        <div className="space-y-4">
          <ChartCard title="بر اساس reason_code">
            <ReasonsBar data={reasons.byCode} />
          </ChartCard>
          <Card className="report-chart-card">
            <CardHeader>
              <CardTitle className="text-base">متن‌های آزاد اخیر</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reasons.recentNotes.length === 0 ? (
                <p className="text-muted-foreground">موردی نیست</p>
              ) : (
                reasons.recentNotes.map((n) => (
                  <div key={n.id} className="rounded-md border p-2">
                    <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
                      <span>{n.fullName}</span>
                      <span>{n.title}</span>
                      {n.reasonCode ? (
                        <Badge variant="outline">{n.reasonCode}</Badge>
                      ) : null}
                    </div>
                    <p>{n.note}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "details" && (
        <DetailsDataTable
          rows={details.rows}
          total={details.total}
          page={filters.page}
          pageSize={details.pageSize}
          countable={details.rates.countable}
        />
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="report-chart-card" data-kpi>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
