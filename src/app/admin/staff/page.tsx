import Link from "next/link";
import { Plus } from "lucide-react";
import { Stack } from "@/components/layout/stack";
import { PageHeader } from "@/components/layout/page-header";
import { StaffDataTable } from "@/components/staff/staff-data-table";
import { Button } from "@/components/ui/button";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import {
  listDepartmentsForSelect,
  listStaffForActor,
} from "@/server/queries/staff";

type Props = {
  searchParams: Promise<{
    q?: string;
    departmentId?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function StaffListPage({ searchParams }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const sp = await searchParams;
  const departments = listDepartmentsForSelect(actor);
  const { rows, total, page, pageSize } = listStaffForActor(actor, {
    q: sp.q,
    departmentId: sp.departmentId ? Number(sp.departmentId) : null,
    status: (sp.status as "active" | "inactive" | "all") || "active",
    page: sp.page ? Number(sp.page) : 1,
    pageSize: sp.pageSize ? Number(sp.pageSize) : 20,
  });

  return (
    <Stack>
      <PageHeader
        title={fa.nav.staff}
        description={
          actor.role === "MANAGER"
            ? "فقط پرسنل دپارتمان خودتان"
            : "مدیریت حساب‌ها، نقش و دسترسی"
        }
        primaryAction={
          <Button asChild>
            <Link href="/admin/staff/new">
              <Plus className="size-4" />
              پرسنل جدید
            </Link>
          </Button>
        }
      />

      <StaffDataTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        showDepartmentFilter={actor.role === "ADMIN"}
        departments={departments}
      />
    </Stack>
  );
}
