import { ReasonCreateForm } from "@/components/reasons/reason-create-form";
import { ReasonsDataTable } from "@/components/reasons/reasons-data-table";
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
import { listNotDoneReasonsAdmin } from "@/lib/settings/not-done-reasons";
import { listDepartmentsSimple } from "@/server/queries/tasks";
import { redirect } from "next/navigation";

export default async function ReasonsPage() {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  if (actor.role !== "ADMIN" && !actor.permissions.includes("tasks.create")) {
    redirect("/admin");
  }

  const departments = listDepartmentsSimple().map((department) => ({
    id: department.id,
    name: department.name,
  }));
  const rows = listNotDoneReasonsAdmin();

  return (
    <Stack>
      <PageHeader
        title={fa.nav.reasons}
        description="دلایلی که پرسنل هنگام ثبت «انجام نشد» انتخاب می‌کنند"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">دلیل جدید</CardTitle>
          <CardDescription>
            می‌توانید دلیل را به یک یا چند دپارتمان محدود کنید.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReasonCreateForm departments={departments} />
        </CardContent>
      </Card>

      <ReasonsDataTable rows={rows} departments={departments} />
    </Stack>
  );
}
