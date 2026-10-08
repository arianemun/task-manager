import Link from "next/link";
import type { HealthReport } from "@/lib/health/db-check";
import {
  dashboardHealthAlerts,
  formatTehranDateTime,
} from "@/lib/health/db-check";
import { formatDiskVolume } from "@/lib/health/disk-space";
import { toFaDigits } from "@/lib/utils";

export function DataHealthAlerts({ report }: { report: HealthReport | null }) {
  const alerts = dashboardHealthAlerts(report);
  const problems = report?.checks.filter((check) => check.count > 0) ?? [];
  if (!alerts.yellow && !alerts.red) return null;

  return (
    <div className="space-y-3">
      {alerts.red && report ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive space-y-2 rounded-lg border px-4 py-3 text-sm leading-[1.7]"
        >
          <p className="font-medium">بررسی سلامت داده مشکل پیدا کرده</p>
          <p className="text-xs">
            زمان بررسی: {formatTehranDateTime(report.ranAt)} (تهران)
          </p>
          <ul className="space-y-1">
            {problems.map((check) => (
              <li key={check.id}>
                {check.title}: {toFaDigits(check.count)}
                {check.detail ? ` — ${check.detail}` : ""}
              </li>
            ))}
            {report.disk?.volumes
              .filter((item) => item.level === "critical")
              .map((item) => (
                <li key={item.id}>{formatDiskVolume(item)}</li>
              ))}
          </ul>
          <Link className="underline underline-offset-2" href="/admin/settings?tab=health">
            جزئیات سلامت داده
          </Link>
        </div>
      ) : null}
      {alerts.diskWarn && report?.disk ? (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-[1.7] text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">فضای دیسک رو به اتمام است</p>
          <ul className="space-y-1">
            {report.disk.volumes
              .filter((item) => item.level === "warn")
              .map((item) => (
                <li key={item.id}>{formatDiskVolume(item)}</li>
              ))}
          </ul>
          <Link className="underline underline-offset-2" href="/admin/settings?tab=health">
            جزئیات سلامت داده
          </Link>
        </div>
      ) : null}
      {alerts.stale ? (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-[1.7] text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">بررسی سلامت داده اجرا نشده</p>
          {report ? (
            <p className="text-xs">
              آخرین اجرا: {formatTehranDateTime(report.ranAt)} (تهران)
            </p>
          ) : null}
          <Link className="underline underline-offset-2" href="/admin/settings?tab=health">
            اجرای بررسی
          </Link>
        </div>
      ) : null}
    </div>
  );
}
