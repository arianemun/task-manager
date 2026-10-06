import { CategoryCreateForm } from "@/components/categories/category-create-form";
import { CategoriesDataTable } from "@/components/categories/categories-data-table";
import { Stack } from "@/components/layout/stack";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { taskCategories, taskTemplates } from "@/db/schema";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { asc, count } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function CategoriesPage() {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  if (
    actor.role !== "ADMIN" &&
    !actor.permissions.includes("tasks.create")
  ) {
    redirect("/admin");
  }

  const categories = db
    .select()
    .from(taskCategories)
    .orderBy(asc(taskCategories.name))
    .all();
  const usage = db
    .select({
      categoryId: taskTemplates.categoryId,
      taskCount: count(),
    })
    .from(taskTemplates)
    .groupBy(taskTemplates.categoryId)
    .all();
  const counts = new Map(
    usage
      .filter((row) => row.categoryId != null)
      .map((row) => [row.categoryId as number, row.taskCount]),
  );

  return (
    <Stack>
      <PageHeader
        title={fa.nav.categories}
        description="دسته‌هایی که هنگام ساخت و ویرایش کار انتخاب می‌شوند"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">دسته جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryCreateForm />
        </CardContent>
      </Card>

      <CategoriesDataTable
        rows={categories.map((row) => ({
          id: row.id,
          name: row.name,
          color: row.color,
          taskCount: counts.get(row.id) ?? 0,
        }))}
      />
    </Stack>
  );
}
