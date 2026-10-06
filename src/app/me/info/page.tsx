import Link from "next/link";
import { Megaphone, Pin } from "lucide-react";
import { Stack } from "@/components/layout/stack";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { DateDisplay } from "@/components/jalali/date-display";
import { db } from "@/db";
import { staffNotes, users } from "@/db/schema";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import { fa } from "@/lib/i18n/fa";
import { cn } from "@/lib/utils";
import { desc, eq } from "drizzle-orm";
import {
  listAnnouncementsForStaff,
  markAnnouncementsReadForUser,
} from "@/server/queries/announcements";

export default async function MeInfoPage() {
  const actor = await requireUserOrRedirect({
    roles: ["STAFF", "ADMIN", "MANAGER"],
  });
  const announcements = listAnnouncementsForStaff(actor);

  const unreadIds = announcements.filter((a) => !a.isRead).map((a) => a.id);
  const wasUnread = new Set(unreadIds);
  if (unreadIds.length > 0) {
    markAnnouncementsReadForUser(actor.id, unreadIds);
  }

  const notes = db
    .select({
      id: staffNotes.id,
      title: staffNotes.title,
      body: staffNotes.body,
      createdAt: staffNotes.createdAt,
      authorName: users.fullName,
    })
    .from(staffNotes)
    .innerJoin(users, eq(staffNotes.authorId, users.id))
    .where(eq(staffNotes.userId, actor.id))
    .orderBy(desc(staffNotes.createdAt))
    .all();

  return (
    <Stack className="overflow-x-hidden">
      <PageHeader
        title={fa.nav.myInfo}
        description="اطلاعیه‌ها و یادداشت‌های مربوط به شما"
        primaryAction={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/me/profile">پروفایل</Link>
          </Button>
        }
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">اطلاعیه‌ها</h2>
        {announcements.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="اطلاعیه‌ای نیست"
            description="وقتی اطلاعیه‌ای منتشر شود اینجا می‌آید"
          />
        ) : (
          announcements.map((a) => (
            <Card
              key={a.id}
              className={cn(
                "relative",
                wasUnread.has(a.id) && "border-primary/40",
              )}
            >
              {wasUnread.has(a.id) ? (
                <span
                  className="bg-primary absolute start-3 top-3 size-2 rounded-full"
                  aria-label="نخوانده"
                />
              ) : null}
              <CardHeader className={cn("pb-2", wasUnread.has(a.id) && "ps-7")}>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {a.title}
                  {a.isPinned ? (
                    <Badge variant="info" className="gap-1">
                      <Pin className="size-3" />
                      سنجاق‌شده
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  <DateDisplay value={a.createdAt} pattern="yyyy/MM/dd" />
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {a.body}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">یادداشت‌های مدیر</h2>
        {notes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{fa.common.empty}</p>
        ) : (
          notes.map((n) => (
            <Card key={n.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{n.title}</CardTitle>
                <CardDescription>
                  {n.authorName} ·{" "}
                  <DateDisplay value={n.createdAt} pattern="yyyy/MM/dd" />
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {n.body}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </Stack>
  );
}
