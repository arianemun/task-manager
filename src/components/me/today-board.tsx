"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, CheckCircle2, Inbox } from "lucide-react";
import { TaskCard } from "@/components/me/task-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import type { NotDoneReason } from "@/lib/settings/not-done-reasons";
import type { MeOccurrence } from "@/server/queries/me-today";

type PinnedAnnouncement = {
  id: number;
  title: string;
  body: string;
};

type Props = {
  fullName: string;
  jalaliDateLabel: string;
  todayList: MeOccurrence[];
  weekList: MeOccurrence[];
  monthList: MeOccurrence[];
  archiveList: MeOccurrence[];
  excusedList: MeOccurrence[];
  progress: { done: number; total: number };
  showLeaveBanner: boolean;
  reasons: NotDoneReason[];
  streakCurrent: number;
  streakBest: number;
  pinned: PinnedAnnouncement[];
  focusId?: number | null;
  nextRevealAt?: number | null;
};

function Group({
  title,
  items,
  reasons,
  focusId,
}: {
  title: string;
  items: MeOccurrence[];
  reasons: NotDoneReason[];
  focusId?: number | null;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="bg-background/95 sticky top-12 z-10 -mx-1 border-b px-1 py-2 text-base font-semibold backdrop-blur-sm">
        {title}
        <span className="text-muted-foreground ms-2 text-sm font-normal tabular-nums">
          ({toFaDigits(items.length)})
        </span>
      </h2>
      <div className="space-y-3">
        {items.map((o) => (
          <TaskCard key={o.id} occ={o} reasons={reasons} highlighted={o.id === focusId} />
        ))}
      </div>
    </section>
  );
}

export function TodayBoard({
  fullName,
  jalaliDateLabel,
  todayList,
  weekList,
  monthList,
  archiveList,
  excusedList,
  progress,
  showLeaveBanner,
  reasons,
  streakCurrent,
  streakBest,
  pinned,
  focusId = null,
  nextRevealAt = null,
}: Props) {
  const router = useRouter();
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`occ-${focusId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId]);
  useEffect(() => {
    if (!nextRevealAt) return;
    const delay = nextRevealAt - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(() => router.refresh(), delay + 500);
    return () => clearTimeout(timer);
  }, [nextRevealAt, router]);
  const openEmpty =
    todayList.length === 0 && weekList.length === 0 && monthList.length === 0;
  const empty = openEmpty && archiveList.length === 0 && excusedList.length === 0;

  const pct =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  const firstName = fullName.trim().split(/\s+/)[0] ?? fullName;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-5">
        <header className="space-y-3">
          <div>
            <p className="text-muted-foreground text-sm">{jalaliDateLabel}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              سلام، {firstName}
            </h1>
          </div>

          {progress.total > 0 ? (
            <div className="flex items-center gap-4">
              <div
                className="relative size-14 shrink-0"
                role="img"
                aria-label={`پیشرفت ${toFaDigits(pct)} درصد`}
              >
                <svg viewBox="0 0 36 36" className="size-14 -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    className="stroke-muted"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    className="stroke-primary transition-all duration-500"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${pct} ${100 - pct}`}
                    pathLength={100}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
                  {toFaDigits(pct)}٪
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {toFaDigits(progress.done)} از{" "}
                    {toFaDigits(progress.total)} کار امروز
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            </div>
          ) : null}
        </header>

        {showLeaveBanner ? (
          <EmptyState
            icon={CalendarOff}
            title="امروز در مرخصی هستید"
            description="کارهای امروز برای شما معاف شده‌اند"
            className="border-sky-200 bg-sky-50/50 py-6 dark:border-sky-900 dark:bg-sky-950/30"
          />
        ) : null}

        {empty && !showLeaveBanner ? (
          <EmptyState
            icon={Inbox}
            title="امروز کاری نیست"
            description="وقتی کاری به شما محول شود اینجا دیده می‌شود"
          />
        ) : null}

        <Group title="امروز" items={todayList} reasons={reasons} focusId={focusId} />
        <Group title="این هفته" items={weekList} reasons={reasons} focusId={focusId} />
        <Group title="این ماه" items={monthList} reasons={reasons} focusId={focusId} />

        {openEmpty && archiveList.length > 0 && !showLeaveBanner ? (
          <p className="text-muted-foreground text-sm">{fa.me.noneOpen}</p>
        ) : null}

        {archiveList.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-muted-foreground border-b py-2 text-base font-semibold">
              {fa.me.archive}
              <span className="ms-2 text-sm font-normal tabular-nums">
                ({toFaDigits(archiveList.length)})
              </span>
            </h2>
            <p className="text-muted-foreground text-xs">{fa.me.archiveHint}</p>
            <div className="space-y-3">
              {archiveList.map((o) => (
                <TaskCard key={o.id} occ={o} reasons={reasons} highlighted={o.id === focusId} />
              ))}
            </div>
          </section>
        ) : null}

        {excusedList.length > 0 ? (
          <section className="space-y-2 opacity-70">
            <h2 className="text-muted-foreground text-sm font-semibold">
              معاف / مرخصی
            </h2>
            <ul className="space-y-2">
              {excusedList.map((o) => (
                <li
                  key={o.id}
                  className="rounded-lg border border-dashed px-3 py-2 text-sm"
                >
                  {o.title}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <aside className="hidden space-y-4 lg:block">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">خلاصه</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">پیشرفت امروز</span>
              <span className="tabular-nums font-medium">
                {progress.total === 0
                  ? "—"
                  : `${toFaDigits(progress.done)}/${toFaDigits(progress.total)}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                streak
              </span>
              <span className="tabular-nums font-medium">
                {toFaDigits(streakCurrent)}
                <span className="text-muted-foreground text-xs">
                  {" "}
                  / بهترین {toFaDigits(streakBest)}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        {pinned.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                اطلاعیه‌های سنجاق‌شده
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pinned.map((a) => (
                <div key={a.id} className="space-y-1 border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="info" className="text-[10px]">
                      سنجاق
                    </Badge>
                    <p className="text-sm font-medium leading-snug">{a.title}</p>
                  </div>
                  <p className="text-muted-foreground line-clamp-3 text-xs">
                    {a.body}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
