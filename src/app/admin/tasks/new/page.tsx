import { notFound } from "next/navigation";
import { TaskForm } from "@/components/tasks/task-form";
import { Stack } from "@/components/layout/stack";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { listStaffForActor } from "@/server/queries/staff";
import {
  getTaskDetail,
  listCategories,
  listDepartmentsSimple,
} from "@/server/queries/tasks";

type Props = {
  searchParams: Promise<{ copy?: string }>;
};

export default async function NewTaskPage({ searchParams }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const sp = await searchParams;

  const categories = listCategories();
  const departments =
    actor.role === "MANAGER" && actor.departmentId
      ? listDepartmentsSimple().filter((d) => d.id === actor.departmentId)
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

  let initial: Parameters<typeof TaskForm>[0]["initial"];
  let copyFromTitle: string | undefined;

  if (sp.copy) {
    const id = Number(sp.copy);
    const detail = getTaskDetail(id);
    if (!detail) notFound();
    const t = detail.template;
    copyFromTitle = t.title;
    initial = {
      id: 0,
      title: `${t.title} (کپی)`,
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
      recurrenceConfig: (t.recurrenceConfig ?? {}) as Record<string, unknown>,
      userIds: detail.userIds,
      departmentIds:
        actor.role === "MANAGER" && actor.departmentId
          ? [actor.departmentId]
          : detail.departmentIds,
    };
  }

  return (
    <Stack>
      <div>
        <h1 className="text-2xl font-semibold">کار جدید</h1>
        <p className="text-muted-foreground text-sm">
          الگوی تکرار، گیرندگان و پیش‌نمایش تاریخ‌ها
        </p>
      </div>
      <TaskForm
        mode="create"
        categories={categories}
        staff={staff}
        departments={departments}
        actorRole={actor.role === "ADMIN" ? "ADMIN" : "MANAGER"}
        managerDepartmentId={actor.departmentId}
        initial={initial}
        copyFromTitle={copyFromTitle}
      />
    </Stack>
  );
}
