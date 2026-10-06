"use client";

import { StatusCell } from "@/components/board/status-cell";
import { STATUS_COLORS, STATUS_ICONS } from "@/components/board/status-colors";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import type { OccurrenceStatus } from "@/db/schema";
import { fa } from "@/lib/i18n/fa";
import { cn, toFaDigits } from "@/lib/utils";
import type { BoardPayload } from "@/server/queries/board";

type Props = {
  data: BoardPayload;
  canEdit: boolean;
};

function staffProgress(
  userId: number,
  cells: BoardPayload["cells"],
): { done: number; total: number; rate: number | null } {
  const mine = cells.filter((c) => c.userId === userId);
  const counted = mine.filter(
    (c) => c.status !== "EXCUSED" && c.status !== "PENDING",
  );
  const done = counted.filter(
    (c) => c.status === "DONE" || c.status === "DONE_LATE",
  ).length;
  const total = counted.length;
  return {
    done,
    total,
    rate: total === 0 ? null : Math.round((done / total) * 100),
  };
}

export function BoardMatrix({ data, canEdit }: Props) {
  const map = new Map<string, (typeof data.cells)[0]>();
  for (const c of data.cells) {
    map.set(`${c.userId}:${c.templateId}`, c);
  }

  if (data.staff.length === 0 || data.tasks.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        برای این بازه داده‌ای نیست
      </p>
    );
  }

  return (
    <>
      {/* دسکتاپ / تبلت: ماتریس با ستون و هدر چسبان */}
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <div className="overflow-x-auto scroll-smooth">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th
                  className={cn(
                    "bg-muted/80 sticky start-0 top-0 z-30 min-w-36 border-b p-2 text-start font-medium backdrop-blur",
                    "shadow-[1px_0_0_0_var(--border)]",
                  )}
                >
                  پرسنل
                </th>
                {data.tasks.map((t) => (
                  <th
                    key={t.id}
                    className="bg-muted/80 sticky top-0 z-20 max-w-36 truncate border-b p-2 text-center text-xs font-medium backdrop-blur"
                    title={t.title}
                  >
                    {t.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.staff.map((s) => (
                <tr key={s.id}>
                  <td
                    className={cn(
                      "bg-background sticky start-0 z-10 border-t p-2 font-medium",
                      "shadow-[1px_0_0_0_var(--border)]",
                    )}
                  >
                    {s.fullName}
                  </td>
                  {data.tasks.map((t) => {
                    const cell = map.get(`${s.id}:${t.id}`);
                    return (
                      <td key={t.id} className="border-t p-1.5 text-center">
                        {cell ? (
                          <StatusCell
                            occurrenceId={cell.occurrenceId}
                            status={cell.status}
                            completedAt={cell.completedAt}
                            note={cell.note}
                            canEdit={canEdit}
                            taskTitle={t.title}
                            staffName={s.fullName}
                            closedByName={
                              cell.completedByUserId &&
                              cell.completedByUserId !== s.id
                                ? cell.completedByName
                                : null
                            }
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* موبایل: آکاردئون بر اساس پرسنل */}
      <div className="md:hidden">
        <Accordion type="single" collapsible className="space-y-2">
          {data.staff.map((s) => {
            const prog = staffProgress(s.id, data.cells);
            const mine = data.tasks
              .map((t) => ({
                task: t,
                cell: map.get(`${s.id}:${t.id}`),
              }))
              .filter((x) => x.cell);

            return (
              <AccordionItem
                key={s.id}
                value={String(s.id)}
                className="rounded-xl border px-3"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 pe-2 text-start">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{s.fullName}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {prog.rate == null
                          ? "—"
                          : `${toFaDigits(prog.rate)}٪`}
                      </span>
                    </div>
                    <Progress
                      value={prog.rate ?? 0}
                      className="h-1.5"
                      aria-label={`پیشرفت ${s.fullName}`}
                    />
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {mine.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {fa.common.empty}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {mine.map(({ task, cell }) => {
                        const status = cell!.status as OccurrenceStatus;
                        const Icon = STATUS_ICONS[status];
                        return (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-2 rounded-lg border p-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {task.title}
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 inline-flex items-center gap-1 text-xs",
                                  STATUS_COLORS[status].bg,
                                  "rounded px-1.5 py-0.5",
                                )}
                              >
                                <Icon className="size-3" aria-hidden />
                                {STATUS_COLORS[status].label}
                              </p>
                            </div>
                            <StatusCell
                              occurrenceId={cell!.occurrenceId}
                              status={cell!.status}
                              completedAt={cell!.completedAt}
                              note={cell!.note}
                              canEdit={canEdit}
                              taskTitle={task.title}
                              staffName={s.fullName}
                              closedByName={
                                cell!.completedByUserId &&
                                cell!.completedByUserId !== s.id
                                  ? cell!.completedByName
                                  : null
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </>
  );
}
