import Link from "next/link";
import { BulkTaskForm } from "@/components/tasks/bulk-task-form";
import { Stack } from "@/components/layout/stack";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { todayTehran } from "@/lib/dates";
import { fa } from "@/lib/i18n/fa";
import { listStaffForActor } from "@/server/queries/staff";
import { listCategories, listDepartmentsSimple, listTasksForActor } from "@/server/queries/tasks";

export default async function BulkTasksPage() {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const categories = listCategories();
  const departments =
    actor.role === "MANAGER"
      ? listDepartmentsSimple().filter((department) =>
          actor.departmentIds.includes(department.id),
        )
      : listDepartmentsSimple();
  const { rows: staffRows } = listStaffForActor(actor, {
    status: "active",
    pageSize: 200,
  });
  const activeTitles = listTasksForActor(actor, { status: "active" }).map(
    (row) => row.title,
  );

  return (
    <Stack>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{fa.common.bulkAddTasks}</h1>
        <p className="text-muted-foreground text-sm">
          عنوان‌ها جدا ساخته می‌شوند و تکرار، گیرنده، دسته، اولویت، نحوه تکمیل و مهلت برای همه یکی است.
        </p>
        <Link href="/admin/tasks" className="text-sm underline">
          {fa.common.back}
        </Link>
      </div>
      <BulkTaskForm
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        staff={staffRows.map((person) => ({
          id: person.id,
          fullName: person.fullName,
        }))}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        activeTitles={activeTitles}
        startDate={todayTehran()}
      />
    </Stack>
  );
}
