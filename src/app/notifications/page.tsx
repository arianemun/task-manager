import Link from "next/link";
import { NotificationRows } from "@/components/notifications/notification-rows";
import { PageHeader } from "@/components/layout/page-header";
import { Stack } from "@/components/layout/stack";
import { Button } from "@/components/ui/button";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import {
  countNotifications,
  listNotifications,
  notificationPageCount,
} from "@/lib/notifications/store";
import { toFaDigits } from "@/lib/utils";
import { markAllNotificationsReadAction } from "@/server/actions/notifications";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
    forbiddenPath: "/login",
  });
  const params = await searchParams;
  const total = countNotifications(user.id);
  const pages = notificationPageCount(total);
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const items = listNotifications(user.id, page);

  return (
    <Stack>
      <PageHeader
        title={fa.notifications.title}
        primaryAction={
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">
              {fa.notifications.markAll}
            </Button>
          </form>
        }
      />
      <div className="bg-card overflow-hidden rounded-lg border">
        <NotificationRows items={items} />
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/notifications?page=${page - 1}`}>{fa.notifications.previous}</Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground tabular-nums">
            {toFaDigits(page)} / {toFaDigits(pages)}
          </span>
          {page < pages ? (
            <Link href={`/notifications?page=${page + 1}`}>{fa.notifications.next}</Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </Stack>
  );
}
