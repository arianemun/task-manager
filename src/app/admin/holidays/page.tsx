import { HolidayForm } from "@/components/holidays/holiday-form";
import { HolidaysDataTable } from "@/components/holidays/holidays-data-table";
import { Stack } from "@/components/layout/stack";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { holidays } from "@/db/schema";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { toJalali } from "@/lib/dates";
import { fa } from "@/lib/i18n/fa";
import { asc } from "drizzle-orm";

export default async function HolidaysPage() {
  await requireUserOrRedirect({ roles: ["ADMIN"], forbiddenPath: "/admin" });
  const rows = db.select().from(holidays).orderBy(asc(holidays.date)).all();

  const tableRows = rows.map((row) => ({
    id: row.id,
    title: row.title,
    jalaliDate: toJalali(row.date).jDate,
    gregorianDate: row.date,
  }));

  return (
    <Stack>
      <PageHeader
        title={fa.nav.holidays}
        description="تعطیلات رسمی — در کارهای روزانه با skip_holidays رد می‌شوند"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">افزودن تعطیل</CardTitle>
          <CardDescription>
            می‌توانید چند روز را با هم انتخاب کنید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HolidayForm />
        </CardContent>
      </Card>

      <HolidaysDataTable rows={tableRows} />
    </Stack>
  );
}
