import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Stack } from "@/components/layout/stack";
import { BoardMatrix } from "@/components/board/board-matrix";
import { LeaveForm } from "@/components/board/leave-form";
import { STATUS_COLORS, STATUS_ICONS } from "@/components/board/status-colors";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUserOrRedirect } from "@/lib/auth/redirect";
import {
  addGregorianDays,
  toJalali,
  todayTehran,
  type GDate,
} from "@/lib/dates";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";
import { loadBoardDay, loadBoardPeriod } from "@/server/queries/board";
import { generateOccurrences } from "@/server/services/occurrence-generate";

type Props = {
  searchParams: Promise<{
    date?: string;
    tab?: string;
  }>;
};

export default async function BoardPage({ searchParams }: Props) {
  const actor = await requireUserOrRedirect({
    roles: ["ADMIN", "MANAGER"],
    forbiddenPath: "/me",
  });
  const sp = await searchParams;
  const tab = sp.tab === "week" || sp.tab === "month" ? sp.tab : "day";
  const date: GDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayTehran();

  // اطمینان از وجود occurrence دوره جاری
  generateOccurrences({ skipCursorUpdate: true, from: date, to: date });

  const data =
    tab === "day"
      ? loadBoardDay(actor, date)
      : loadBoardPeriod(actor, tab, date);

  const j = toJalali(date);
  const prev = addGregorianDays(date, -1);
  const next = addGregorianDays(date, 1);
  const canEdit = actor.permissions.includes("tasks.assign") || actor.role === "ADMIN";

  return (
    <Stack>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{fa.nav.board}</h1>
          <p className="text-muted-foreground text-sm">
            ماتریس پرسنل × کار — {toFaDigits(j.jDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="icon" variant="outline">
            <Link
              href={`/admin/board?tab=${tab}&date=${prev}`}
              aria-label="روز قبل"
            >
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/board?tab=${tab}&date=${todayTehran()}`}>
              امروز
            </Link>
          </Button>
          <Button asChild size="icon" variant="outline">
            <Link
              href={`/admin/board?tab=${tab}&date=${next}`}
              aria-label="روز بعد"
            >
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["day", "روزانه"],
            ["week", "این هفته"],
            ["month", "این ماه"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            asChild
            size="sm"
            variant={tab === key ? "default" : "outline"}
          >
            <Link href={`/admin/board?tab=${key}&date=${date}`}>{label}</Link>
          </Button>
        ))}
      </div>

      {tab === "day" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>درصد انجام امروز</CardDescription>
              <CardTitle className="text-2xl">
                {data.summary.completionRate == null
                  ? "—"
                  : `${toFaDigits(data.summary.completionRate)}٪`}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>بی‌پاسخ</CardDescription>
              <CardTitle className="text-2xl">
                {toFaDigits(data.summary.unanswered)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>بدون هیچ پاسخ امروز</CardDescription>
              <CardTitle className="text-muted-foreground text-sm font-normal leading-relaxed">
                {data.summary.silentStaff.length === 0
                  ? "—"
                  : data.summary.silentStaff.map((s) => s.fullName).join("، ")}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(STATUS_COLORS).map(([k, v]) => {
          const Icon = STATUS_ICONS[k as keyof typeof STATUS_ICONS];
          return (
            <span
              key={k}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 ${v.bg}`}
            >
              <Icon className="size-3.5" aria-hidden />
              {v.label}
            </span>
          );
        })}
      </div>

      <BoardMatrix data={data} canEdit={canEdit} />

      {tab === "day" && canEdit ? (
        <div className="flex justify-end">
          <LeaveForm staff={data.staff} />
        </div>
      ) : null}
    </Stack>
  );
}
