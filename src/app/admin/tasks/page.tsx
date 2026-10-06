import Link from "next/link";
import { Plus } from "lucide-react";
import { Stack } from "@/components/layout/stack";
import { PageHeader } from "@/components/layout/page-header";
import { TasksDataTable } from "@/components/tasks/tasks-data-table";
import { Button } from "@/components/ui/button";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { canManagerEditTemplate } from "@/lib/scope/tasks";
import {
  listCategories,
  listDepartmentsSimple,
  listTasksForActor,
} from "@/server/queries/tasks";

type Props = {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    recurrenceType?: string;
    status?: string;
    departmentId?: string;
  }>;
};

export default async function TasksPage({ searchParams }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const sp = await searchParams;
  const categories = listCategories();
  const departments =
    actor.role === "ADMIN"
      ? listDepartmentsSimple()
      : listDepartmentsSimple().filter((d) => d.id === actor.departmentId);

  const rows = listTasksForActor(actor, {
    q: sp.q,
    categoryId: sp.categoryId ? Number(sp.categoryId) : null,
    recurrenceType: sp.recurrenceType || null,
    status: (sp.status as "active" | "archived" | "all") || "active",
    departmentId: sp.departmentId ? Number(sp.departmentId) : null,
  });

  const tableRows = rows.map((row) => ({
    id: row.id,
    title: row.title,
    recurrenceSummary: row.recurrenceSummary,
    categoryName: row.categoryName,
    priority: row.priority as keyof typeof fa.priority,
    isActive: row.isActive,
    canEdit: canManagerEditTemplate(actor, row.id),
  }));

  return (
    <Stack>
      <PageHeader
        title={fa.nav.tasks}
        description="تعریف الگوهای تکرار و اساین به پرسنل / دپارتمان"
        primaryAction={
          <Button asChild>
            <Link href="/admin/tasks/new">
              <Plus className="size-4" />
              کار جدید
            </Link>
          </Button>
        }
      />

      <TasksDataTable
        rows={tableRows}
        categories={categories}
        departments={departments}
        showDepartmentFilter={actor.role === "ADMIN"}
      />
    </Stack>
  );
}
