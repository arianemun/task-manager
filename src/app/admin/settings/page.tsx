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
import { formatByteSize, formatDiskVolume, measureDiskSpace } from "@/lib/health/disk-space";
import {
  formatTehranDateTime,
  loadLastHealthReport,
} from "@/lib/health/db-check";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import { rerunDataHealthCheckAction } from "@/server/actions/data-health";
import { chatPreviewHidden } from "@/lib/push/settings";
import { savePushPreviewAction } from "@/server/actions/push-settings";

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
  const disk = measureDiskSpace();
  const hidePreview = chatPreviewHidden();

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
              <div className="space-y-1">
                {disk.volumes.map((item) => (
                  <p
                    key={item.id}
                    className={
                      item.level === "critical"
                        ? "text-destructive"
                        : item.level === "warn"
                          ? "text-amber-700 dark:text-amber-200"
                          : undefined
                    }
                  >
                    {formatDiskVolume(item)}
                  </p>
                ))}
                {disk.sections.map((item) => (
                  <p key={item.id}>
                    حجم {item.title}: {formatByteSize(item.bytes)}
                  </p>
                ))}
              </div>
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
            <CardContent>
              <form action={savePushPreviewAction} className="space-y-3 text-sm leading-[1.7]">
                <label className="flex min-h-11 items-start gap-2">
                  <input type="checkbox" name="hide" defaultChecked={hidePreview} className="mt-1" />
                  <span>
                    <span className="font-medium">{fa.push.hidePreview}</span>
                    <span className="text-muted-foreground block">{fa.push.hidePreviewHint}</span>
                  </span>
                </label>
                <Button type="submit">{fa.common.save}</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
