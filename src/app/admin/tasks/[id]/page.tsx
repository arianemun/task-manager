import { notFound } from "next/navigation";
import { Stack } from "@/components/layout/stack";
import { TaskForm } from "@/components/tasks/task-form";
import { Badge } from "@/components/ui/badge";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { canManagerEditTemplate, templatesVisibleToActor } from "@/lib/scope/tasks";
import { listStaffForActor } from "@/server/queries/staff";
import {
  getTaskDetail,
  listCategories,
  listDepartmentsSimple,
} from "@/server/queries/tasks";

type Props = { params: Promise<{ id: string }> };

export default async function EditTaskPage({ params }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const visible = templatesVisibleToActor(actor);
  if (!visible.includes(id)) notFound();

  const detail = getTaskDetail(id);
  if (!detail) notFound();

  const canEdit = canManagerEditTemplate(actor, id);
  const categories = listCategories();
  const departments =
    actor.role === "MANAGER"
      ? listDepartmentsSimple().filter((d) =>
          actor.departmentIds.includes(d.id),
        )
      : listDepartmentsSimple();
  const { rows: staffRows } = listStaffForActor(actor, {
    status: "active",
    pageSize: 200,
  });
  const staff = staffRows.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    departmentId: s.departmentId,
  }));

  const t = detail.template;

  return (
    <Stack>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Badge variant={t.isActive ? "default" : "secondary"}>
          {t.isActive ? "فعال" : "آرشیو"}
        </Badge>
        {detail.occurrenceCount > 0 ? (
          <Badge variant="outline">
            {detail.occurrenceCount} occurrence
          </Badge>
        ) : null}
        {!canEdit ? (
          <Badge variant="destructive">فقط مشاهده (خارج از محدوده ویرایش)</Badge>
        ) : null}
      </div>

      {canEdit ? (
        <TaskForm
          mode="edit"
          categories={categories}
          staff={staff}
          departments={departments}
          actorRole={actor.role === "ADMIN" ? "ADMIN" : "MANAGER"}
          managerDepartmentId={
            actor.departmentIds.length === 1 ? actor.departmentIds[0] : null
          }
          initial={{
            id: t.id,
            title: t.title,
            description: t.description,
            categoryId: t.categoryId,
            priority: t.priority,
            requiresNote: t.requiresNote,
            requiresAttachment: t.requiresAttachment,
            skipHolidays: t.skipHolidays,
            startDate: t.startDate,
            endDate: t.endDate,
            dueTime: t.dueTime,
            recurrenceType: t.recurrenceType,
            recurrenceConfig: (t.recurrenceConfig ?? {}) as Record<
              string,
              unknown
            >,
            userIds: detail.userIds,
            departmentIds: detail.departmentIds,
            occurrenceCount: detail.occurrenceCount,
          }}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          این کار گیرنده‌هایی خارج از دپارتمان شما دارد و قابل ویرایش نیست.
        </p>
      )}
    </Stack>
  );
}
