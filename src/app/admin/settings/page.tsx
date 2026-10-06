import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";

export default async function AdminSettingsPage() {
  await requireUserOrRedirect({ roles: ["ADMIN"], forbiddenPath: "/admin" });

  return (
    <Stack>
      <PageHeader
        title={fa.nav.settings}
        description="تنظیمات سامانه"
      />

      <Tabs defaultValue="reasons" className="w-full">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="reasons" className="shrink-0">
            دلایل انجام‌نشدن
          </TabsTrigger>
          <TabsTrigger value="general" className="shrink-0">
            عمومی
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reasons" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">دلایل انجام‌نشدن</CardTitle>
              <CardDescription>
                افزودن، ویرایش و تخصیص دلیل به دپارتمان از بخش جدا انجام می‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/admin/reasons">{fa.nav.reasons}</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">عمومی</CardTitle>
              <CardDescription>
                تنظیمات بیشتر در نسخه‌های بعدی اضافه می‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              فعلاً موردی برای پیکربندی نیست.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
