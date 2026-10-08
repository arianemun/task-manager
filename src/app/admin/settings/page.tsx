import Link from "next/link";
import { RerunHealthButton } from "@/components/admin/rerun-health-button";
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
import { chatMediaDiskUsage, formatByteSize } from "@/lib/chat/media-size";
import {
  formatTehranDateTime,
  loadLastHealthReport,
} from "@/lib/health/db-check";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import { rerunDataHealthCheckAction } from "@/server/actions/data-health";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireUserOrRedirect({ roles: ["ADMIN"], forbiddenPath: "/admin" });
  const params = await searchParams;
  const tab =
    params.tab === "health" || params.tab === "general" || params.tab === "reasons"
      ? params.tab
      : "reasons";
  const health = loadLastHealthReport();
  const chatMedia = chatMediaDiskUsage();

  return (
    <Stack>
      <PageHeader
        title={fa.nav.settings}
        description="تنظیمات سامانه"
      />

      <Tabs defaultValue={tab} className="w-full">
        <TabsList className="h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="reasons" className="shrink-0">
            دلایل انجام‌نشدن
          </TabsTrigger>
          <TabsTrigger value="health" className="shrink-0">
            سلامت داده
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
        <TabsContent value="health" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">سلامت داده</CardTitle>
              <CardDescription>
                این بررسی فقط می‌خواند و داده‌ای را اصلاح نمی‌کند.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-[1.7]">
              <p>
                حجم کل رسانهٔ چت: {formatByteSize(chatMedia.bytes)} در{" "}
                {toFaDigits(chatMedia.files)} فایل
              </p>
              <form action={rerunDataHealthCheckAction}>
                <RerunHealthButton />
              </form>
              {health ? (
                <div className="space-y-3">
                  <p>
                    آخرین اجرا: {formatTehranDateTime(health.ranAt)} (تهران) —{" "}
                    {health.ok ? "سالم" : "مشکل دارد"} — مدت{" "}
                    {toFaDigits(health.elapsedMs)} میلی‌ثانیه
                  </p>
                  <ul className="space-y-3">
                    {health.checks.map((check, index) => (
                      <li key={check.id} className="space-y-1">
                        <p>
                          {toFaDigits(index + 1)}. {check.title} —{" "}
                          {toFaDigits(check.count)}
                        </p>
                        {check.detail ? (
                          <p className="text-muted-foreground">{check.detail}</p>
                        ) : null}
                        {check.sampleIds.length > 0 ? (
                          <p className="text-muted-foreground tabular-nums">
                            نمونه id: {check.sampleIds.join("، ")}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  هنوز بررسی‌ای ثبت نشده است.
                </p>
              )}
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
