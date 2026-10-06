import { DepartmentCreateForm } from "@/components/departments/department-create-form";
import { DepartmentsDataTable } from "@/components/departments/departments-data-table";
import { Stack } from "@/components/layout/stack";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { listAllDepartments } from "@/server/queries/staff";

export default async function DepartmentsPage() {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  let rows = listAllDepartments();
  if (actor.role === "MANAGER" && actor.departmentId) {
    rows = rows.filter((d) => d.id === actor.departmentId);
  }

  return (
    <Stack>
      <PageHeader
        title={fa.nav.departments}
        description="حذف دپارتمان دارای عضو مجاز نیست"
      />

      {actor.role === "ADMIN" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">دپارتمان جدید</CardTitle>
          </CardHeader>
          <CardContent>
            <DepartmentCreateForm />
          </CardContent>
        </Card>
      ) : null}

      <DepartmentsDataTable
        rows={rows}
        canDelete={actor.role === "ADMIN"}
      />
    </Stack>
  );
}
