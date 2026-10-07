import { AppCredit } from "@/components/layout/app-credit";
import { AvatarForm } from "@/components/me/avatar-form";
import { ChangePasswordDialog } from "@/components/me/change-password-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { eq } from "drizzle-orm";

export default async function MeProfilePage() {
  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
  });
  const full = db.select().from(users).where(eq(users.id, user.id)).get();

  return (
    <Stack className="overflow-x-hidden">
      <PageHeader
        title={fa.nav.profile}
        description="آواتار، اطلاعات و تغییر رمز"
      />

      <Card>
        <CardHeader>
          <CardTitle>آواتار</CardTitle>
          <CardDescription>
            پس از انتخاب، ناحیهٔ نمایش را برش دهید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarForm fullName={user.fullName} avatarPath={user.avatarPath} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اطلاعات حساب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-[1.7]">
          <Row label="نام" value={user.fullName} />
          <Row label="نام کاربری" value={user.username} ltr />
          <Row label="نقش" value={fa.roles[user.role]} />
          {full?.phone ? <Row label="موبایل" value={full.phone} ltr /> : null}
          {full?.position ? (
            <Row label="سمت" value={full.position} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>امنیت</CardTitle>
          <CardDescription>تغییر رمز عبور حساب</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordDialog />
        </CardContent>
      </Card>

      <AppCredit />
    </Stack>
  );
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  );
}
