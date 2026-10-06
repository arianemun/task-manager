import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { AnnouncementsDataTable } from "@/components/announcements/announcements-data-table";
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
import {
  announcementReadCounts,
  listAnnouncementsForAdmin,
} from "@/server/queries/announcements";
import { listDepartmentsForSelect } from "@/server/queries/staff";

export default async function AnnouncementsAdminPage() {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const departments = listDepartmentsForSelect(actor);
  const rows = listAnnouncementsForAdmin(actor);

  const tableRows = rows.map((row) => {
    const stats = announcementReadCounts(row.id);
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      authorName: row.authorName,
      departmentName: row.departmentName,
      isPinned: row.isPinned,
      createdAt: row.createdAt,
      read: stats.read,
      total: stats.total,
    };
  });

  return (
    <Stack>
      <PageHeader
        title={fa.nav.announcements}
        description="تعداد خوانده/نخوانده برای هر اطلاعیه نمایش داده می‌شود"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">اطلاعیه جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm
            departments={departments}
            isManager={actor.role === "MANAGER"}
          />
        </CardContent>
      </Card>

      <AnnouncementsDataTable rows={tableRows} />
    </Stack>
  );
}
