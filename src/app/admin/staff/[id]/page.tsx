import Link from "next/link";
import { Stack } from "@/components/layout/stack";
import { notFound } from "next/navigation";
import { StaffToolbar } from "@/components/staff/staff-actions";
import { NoteForm } from "@/components/staff/note-form";
import { PermissionsForm } from "@/components/staff/permissions-form";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffDetailTabs } from "@/components/staff/staff-detail-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateDisplay } from "@/components/jalali/date-display";
import { isAuthError } from "@/lib/auth/errors";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { parseReportFilters } from "@/lib/reports";
import {
  getStaffDetailForActor,
  listDepartmentsForSelect,
  listStaffForActor,
} from "@/server/queries/staff";
import { listCategories, listTasksForActor } from "@/server/queries/tasks";
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
  sharedGroupSummary,
  staffDayHeatmap,
} from "@/server/queries/admin-reports";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`;
}

export default async function StaffDetailPage({ params, searchParams }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  let detail;
  try {
    detail = getStaffDetailForActor(actor, id);
  } catch (e) {
    if (isAuthError(e)) notFound();
    throw e;
  }

  const sp = await searchParams;
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const departments = listDepartmentsForSelect(actor);
  const { user, departments: memberships, permissions, notes } = detail;
  const departmentLabel =
    memberships.map((item) => item.name).join("، ") || null;

  const reportTabs = new Set([
    "report",
    "summary",
    "staff",
    "departments",
    "tasks",
    "patterns",
    "reasons",
    "details",
  ]);

  // تب گزارش (سازگاری با tab=summary قبلی)
  if (tabRaw && reportTabs.has(tabRaw)) {
    const filters = parseReportFilters(sp);
    filters.userId = id;
    if (actor.role === "MANAGER" && actor.departmentIds.length === 1) {
      filters.departmentId = actor.departmentIds[0]!;
    }
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
    const sharedGroup = sharedGroupSummary(actor, filters);
    const canExport =
      actor.role === "ADMIN" || actor.permissions.includes("reports.export");

    // lazy: نمودار/recharts فقط وقتی تب گزارش باز است وارد گراف کلاینت می‌شود
    const { StaffReportPanel } = await import(
      "@/components/staff/staff-report-panel"
    );

    return (
      <Stack>
        <StaffDetailHeader user={user} departmentName={departmentLabel} />
        <StaffDetailTabs userId={id} active="report" />
        <StaffReportPanel
          filters={filters}
          basePath={`/admin/staff/${id}`}
          departments={departments}
          staffOptions={staffRows.map((s) => ({
            id: s.id,
            name: s.fullName,
            fullName: s.fullName,
          }))}
          categories={categories}
          lockUserId={id}
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
          sharedGroup={sharedGroup}
        />
      </Stack>
    );
  }

  const activeTab =
    tabRaw === "tasks" || tabRaw === "notes" || tabRaw === "info"
      ? tabRaw
      : "info";

  const membershipIds = memberships.map((item) => item.id);
  const taskDepartmentIds =
    actor.role === "MANAGER"
      ? membershipIds.filter((id) => actor.departmentIds.includes(id))
      : membershipIds;
  const assignedTasks =
    activeTab === "tasks"
      ? listTasksForActor(actor, {
          status: "active",
          departmentIds: taskDepartmentIds,
        })
      : [];

  return (
    <Stack>
      <StaffDetailHeader user={user} departmentName={departmentLabel} />
      <StaffDetailTabs userId={id} active={activeTab} />

      {activeTab === "info" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">خلاصه</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">نقش</span>
                <span>{fa.roles[user.role]}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">دپارتمان</span>
                <span>{departmentLabel ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">وضعیت</span>
                <Badge variant={user.isActive ? "success" : "muted"}>
                  {user.isActive ? fa.common.active : fa.common.inactive}
                </Badge>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">آخرین ورود</span>
                <DateDisplay
                  value={user.lastLoginAt}
                  pattern="yyyy/MM/dd HH:mm"
                />
              </div>
              <div className="pt-3">
                <StaffToolbar userId={user.id} isActive={user.isActive} />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">ویرایش اطلاعات</CardTitle>
              <CardDescription>تغییر نقش خودتان مجاز نیست</CardDescription>
            </CardHeader>
            <CardContent>
              <StaffForm
                mode="edit"
                departments={departments}
                actorRole={actor.role}
                initial={{
                  id: user.id,
                  username: user.username,
                  fullName: user.fullName,
                  nationalCode: user.nationalCode,
                  phone: user.phone,
                  email: user.email,
                  position: user.position,
                  departmentId: user.departmentId,
                  departmentIds: memberships.map((item) => item.id),
                  role: user.role,
                  hireDate: user.hireDate,
                  permissions,
                }}
              />
            </CardContent>
          </Card>

          {actor.role === "ADMIN" ? (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">مجوزهای تکی</CardTitle>
              </CardHeader>
              <CardContent>
                <PermissionsForm userId={user.id} permissions={permissions} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {activeTab === "tasks" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">کارهای مرتبط</CardTitle>
            <CardDescription>
              الگوهای فعال مرتبط با دپارتمان این پرسنل
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignedTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">{fa.common.empty}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {assignedTasks.slice(0, 40).map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.recurrenceSummary}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/tasks/${t.id}`}>مشاهده</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "notes" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">یادداشت جدید</CardTitle>
            </CardHeader>
            <CardContent>
              <NoteForm userId={user.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تاریخچه یادداشت‌ها</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {fa.common.empty}
                </p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{n.title}</p>
                      <DateDisplay value={n.createdAt} pattern="MM/dd HH:mm" />
                    </div>
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                      {n.body}
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs">
                      نویسنده: {n.authorName}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </Stack>
  );
}

function StaffDetailHeader({
  user,
  departmentName,
}: {
  user: {
    fullName: string;
    username: string;
    avatarPath: string | null;
    role: keyof typeof fa.roles;
    isActive: boolean;
    position: string | null;
  };
  departmentName?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size="lg" className="size-14">
          {user.avatarPath ? (
            <AvatarImage src={user.avatarPath} alt={user.fullName} />
          ) : null}
          <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-semibold">{user.fullName}</h1>
          <p className="text-muted-foreground text-sm" dir="ltr">
            @{user.username}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{fa.roles[user.role]}</Badge>
            {departmentName ? (
              <span className="text-muted-foreground">{departmentName}</span>
            ) : null}
            {user.position ? (
              <span className="text-muted-foreground">{user.position}</span>
            ) : null}
            <Badge variant={user.isActive ? "success" : "muted"}>
              {user.isActive ? fa.common.active : fa.common.inactive}
            </Badge>
          </div>
        </div>
      </div>
      <Button asChild variant="outline">
        <Link href="/admin/staff">بازگشت</Link>
      </Button>
    </div>
  );
}
