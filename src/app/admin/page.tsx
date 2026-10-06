import Link from "next/link";
import { DataHealthAlerts } from "@/components/admin/data-health-alerts";
import { StatusDonut, TrendAreaChart } from "@/components/reports/charts";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { EMPTY_RATE_HINT, parseReportFilters } from "@/lib/reports";
import { toFaDigits } from "@/lib/utils";
import { loadLastHealthReport } from "@/lib/health/db-check";
import {
  aggregateByDay,
  aggregateStatusDonut,
  loadDashboardKpis,
} from "@/server/queries/admin-reports";

export default async function AdminDashboardPage() {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });

  const kpis = loadDashboardKpis(actor);
  const monthFilters = parseReportFilters({ range: "month" });
  if (actor.role === "MANAGER" && actor.departmentIds.length === 1) {
    monthFilters.departmentId = actor.departmentIds[0]!;
  }
  const trend = aggregateByDay(actor, { ...monthFilters, granularity: "day" });
  const donut = aggregateStatusDonut(actor, monthFilters);

  const healthReport =
    actor.role === "ADMIN" ? loadLastHealthReport() : null;

  return (
    <Stack>
      {actor.role === "ADMIN" ? (
        <DataHealthAlerts report={healthReport} />
      ) : null}
      <PageHeader
        title={fa.nav.dashboard}
        description={
          <>
            خلاصه عملکرد —{" "}
            <Link className="text-primary underline" href="/admin/reports">
              گزارش کامل
            </Link>
          </>
        }
      >
        <p className="text-muted-foreground text-sm leading-[1.7]">
          پرسنل فعال: {toFaDigits(kpis.activeStaff)}
        </p>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
        <Kpi
          label="درصد انجام امروز"
          value={
            kpis.today.completionRate == null
              ? "—"
              : `${toFaDigits(kpis.today.completionRate)}٪`
          }
          hint={kpis.today.completionRate == null ? EMPTY_RATE_HINT : `در جریان: ${toFaDigits(kpis.today.inProgress)}`}
        />
        <Kpi
          label="درصد انجام این هفته"
          value={
            kpis.week.completionRate == null
              ? "—"
              : `${toFaDigits(kpis.week.completionRate)}٪`
          }
          hint={kpis.week.completionRate == null ? EMPTY_RATE_HINT : `در جریان: ${toFaDigits(kpis.week.inProgress)}`}
        />
        <Kpi
          label="درصد انجام این ماه"
          value={
            kpis.month.completionRate == null
              ? "—"
              : `${toFaDigits(kpis.month.completionRate)}٪`
          }
          hint={kpis.month.completionRate == null ? EMPTY_RATE_HINT : `در جریان: ${toFaDigits(kpis.month.inProgress)}`}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>روند این ماه</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendAreaChart data={trend.buckets} average={trend.average} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>وضعیت این ماه</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonut counts={donut.counts} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>نیازمند توجه</CardTitle>
          <CardDescription>
            بی‌پاسخ‌های امروز و درصد زیر ۵۰٪ در ۷ روز اخیر
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 md:gap-6">
          <section className="bg-muted/30 space-y-3 rounded-lg border p-4 text-sm leading-[1.7]">
            <p className="font-medium">بی‌پاسخ امروز</p>
            {kpis.unanswered.length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {kpis.unanswered.map((s) => (
                  <li key={s.userId}>
                    <Link
                      className="text-primary underline-offset-2 hover:underline"
                      href={`/admin/staff/${s.userId}?tab=report`}
                    >
                      {s.fullName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="bg-muted/30 space-y-3 rounded-lg border p-4 text-sm leading-[1.7]">
            <p className="font-medium">درصد ۷ روز اخیر زیر ۵۰٪</p>
            {kpis.lowPerformers.length === 0 ? (
              <p className="text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2">
                {kpis.lowPerformers.map((s) => (
                  <li key={s.userId} className="flex flex-wrap gap-2">
                    <Link
                      className="text-primary underline-offset-2 hover:underline"
                      href={`/admin/staff/${s.userId}?tab=report`}
                    >
                      {s.fullName}
                    </Link>
                    <span className="text-muted-foreground tabular-nums">
                      ({toFaDigits(s.completionRate)}٪)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>
    </Stack>
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
