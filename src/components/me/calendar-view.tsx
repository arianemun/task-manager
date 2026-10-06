"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useIsDesktop } from "@/hooks/use-media-query";
import { fa } from "@/lib/i18n/fa";
import { cn, toFaDigits } from "@/lib/utils";
import type { CalendarDayCell } from "@/server/queries/me-calendar";

type DetailItem = {
  id: number;
  title: string;
  status: string;
  note: string | null;
};

type Props = {
  jy: number;
  jm: number;
  cells: CalendarDayCell[];
  selected?: string;
  prevHref: string;
  nextHref: string;
  detail?: DetailItem[];
};

function dayDotClass(cell: CalendarDayCell): string {
  if (!cell.inMonth || cell.isFuture) return "bg-transparent";
  if (cell.isLeave) return "bg-sky-500";
  if (cell.isHoliday) return "bg-violet-500";
  if (cell.rate == null) return "bg-muted-foreground/30";
  if (cell.rate >= 80) return "dot-status-done";
  if (cell.rate >= 50) return "dot-status-late";
  return "dot-status-not-done";
}

function DayDetailList({ detail }: { detail: DetailItem[] }) {
  if (detail.length === 0) {
    return <p className="text-muted-foreground text-sm">موردی نیست</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {detail.map((d) => (
        <li
          key={d.id}
          className="flex items-start justify-between gap-2 border-b pb-2 last:border-0"
        >
          <span className="min-w-0">{d.title}</span>
          <Badge
            variant={
              d.status === "DONE" || d.status === "DONE_LATE"
                ? "success"
                : d.status === "NOT_DONE" || d.status === "MISSED"
                  ? "danger"
                  : d.status === "EXCUSED"
                    ? "info"
                    : "muted"
            }
            className="shrink-0"
          >
            {fa.status[d.status as keyof typeof fa.status] ?? d.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function CalendarView({
  jy,
  jm,
  cells,
  selected,
  prevHref,
  nextHref,
  detail,
}: Props) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (selected && !isDesktop) setDrawerOpen(true);
    if (!selected) setDrawerOpen(false);
  }, [selected, isDesktop]);

  function selectDay(gDate: string) {
    router.push(
      `/me/calendar?month=${String(jy)}-${String(jm).padStart(2, "0")}&date=${gDate}`,
    );
  }

  const detailPanel = selected && detail ? (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">
        کارهای {toFaDigits(selected)}
      </h3>
      <DayDetailList detail={detail} />
    </div>
  ) : null;

  return (
    <div className="grid gap-6 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="mx-auto w-full min-w-0 max-w-md space-y-4 lg:mx-0 lg:max-w-none">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={prevHref} aria-label="ماه قبل">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <h2 className="font-semibold tabular-nums">
            {toFaDigits(jm)} / {toFaDigits(jy)}
          </h2>
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={nextHref} aria-label="ماه بعد">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center sm:gap-1">
          {([0, 1, 2, 3, 4, 5, 6] as const).map((wd) => (
            <div
              key={wd}
              className="text-muted-foreground py-1 text-[10px] font-medium sm:text-xs"
            >
              {fa.weekdays[wd].slice(0, 1)}
            </div>
          ))}
          {cells.map((cell) => (
            <button
              key={`${cell.gDate}-${cell.inMonth ? "m" : "p"}`}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => selectDay(cell.gDate)}
              className={cn(
                "relative aspect-square w-full min-w-0 rounded-md text-sm tabular-nums",
                "flex flex-col items-center justify-center gap-0.5",
                !cell.inMonth && "text-muted-foreground/40",
                cell.inMonth && "hover:bg-muted/60",
                selected === cell.gDate && "ring-primary bg-muted/40 ring-2",
              )}
            >
              <span>{toFaDigits(cell.jDay)}</span>
              {cell.inMonth ? (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    dayDotClass(cell),
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <LegendDot className="dot-status-done" label="بالا (≥۸۰٪)" />
          <LegendDot className="dot-status-late" label="متوسط" />
          <LegendDot className="dot-status-not-done" label="پایین" />
          <LegendDot className="bg-violet-500" label="تعطیل" />
          <LegendDot className="bg-sky-500" label="مرخصی" />
        </div>
      </div>

      {/* دسکتاپ: پنل کناری */}
      <aside className="hidden rounded-xl border p-4 lg:block">
        {detailPanel ?? (
          <p className="text-muted-foreground text-sm">
            یک روز را انتخاب کنید
          </p>
        )}
      </aside>

      {/* موبایل/تبلت: Drawer */}
      {!isDesktop ? (
        <ResponsiveDialog
          open={drawerOpen && Boolean(selected)}
          onOpenChange={(o) => {
            setDrawerOpen(o);
            if (!o) {
              router.push(
                `/me/calendar?month=${String(jy)}-${String(jm).padStart(2, "0")}`,
              );
            }
          }}
        >
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>
                کارهای روز {selected ? toFaDigits(selected) : ""}
              </ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody>
              {detail ? <DayDetailList detail={detail} /> : null}
            </ResponsiveDialogBody>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      ) : null}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}
