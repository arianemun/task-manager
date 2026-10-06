import { NotDoneReasonsForm } from "@/components/settings/not-done-reasons-form";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
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
import { getNotDoneReasons } from "@/lib/settings/not-done-reasons";

export default async function AdminSettingsPage() {
  await requireUserOrRedirect({ roles: ["ADMIN"], forbiddenPath: "/admin" });
  const reasons = getNotDoneReasons();

  return (
    <Stack>
      <PageHeader
        title={fa.nav.settings}
        description="تنظیمات سامانه — دلایل آماده «انجام نشد»"
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
                این chipها در پنل پرسنل هنگام ثبت «انجام نشد» نمایش داده می‌شوند.
                کدها برای گزارش‌گیری فاز ۷ نگه داشته می‌شوند.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotDoneReasonsForm initialReasons={reasons} />
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
