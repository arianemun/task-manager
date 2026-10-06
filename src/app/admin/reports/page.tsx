import { ReportShell } from "@/components/reports/report-shell";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { parseReportFilters } from "@/lib/reports";
import { listDepartmentsForSelect, listStaffForActor } from "@/server/queries/staff";
import { listCategories } from "@/server/queries/tasks";
import {
  aggregateByDay,
  aggregateByDepartment,
  aggregateByStaff,
  aggregateCompletionHours,
  aggregateReasons,
  aggregateStatusDonut,
  aggregateWeekdayRates,
  aggregateWorstTasks,
  listOccurrenceDetails,
  staffDayHeatmap,
} from "@/server/queries/admin-reports";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminReportsPage({ searchParams }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });

  const canView =
    actor.role === "ADMIN" ||
    actor.permissions.includes("reports.view_all") ||
    actor.permissions.includes("reports.view_department");
  if (!canView) {
    return (
      <p className="text-destructive text-sm">مجوز مشاهده گزارش را ندارید.</p>
    );
  }

  const sp = await searchParams;
  const filters = parseReportFilters(sp);
  if (actor.role === "MANAGER" && actor.departmentId) {
    filters.departmentId = actor.departmentId;
  }

  const departments = listDepartmentsForSelect(actor);
  const { rows: staffRows } = listStaffForActor(actor, {
    status: "active",
    pageSize: 200,
  });
  const categories = listCategories();

  const day = aggregateByDay(actor, filters);
  const donut = aggregateStatusDonut(actor, filters);
  const staff = aggregateByStaff(actor, filters);
  const departmentsData = aggregateByDepartment(actor, filters);
  const tasks = aggregateWorstTasks(actor, filters);
  const weekdays = aggregateWeekdayRates(actor, filters);
  const hours = aggregateCompletionHours(actor, filters);
  const reasons = aggregateReasons(actor, filters);
  const heatmap = staffDayHeatmap(actor, filters);
  const details = listOccurrenceDetails(actor, filters);

  const canExport =
    actor.role === "ADMIN" || actor.permissions.includes("reports.export");

  return (
    <ReportShell
      filters={filters}
      basePath="/admin/reports"
      departments={departments}
      staffOptions={staffRows.map((s) => ({
        id: s.id,
        name: s.fullName,
        fullName: s.fullName,
      }))}
      categories={categories}
      showDepartment={actor.role === "ADMIN"}
      canExport={canExport}
      day={day}
      donut={donut}
      staff={staff}
      departmentsData={departmentsData}
      tasks={tasks}
      weekdays={weekdays}
      hours={hours}
      reasons={reasons}
      heatmap={heatmap}
      details={details}
    />
  );
}
