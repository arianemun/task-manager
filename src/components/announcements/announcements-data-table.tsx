"use client";

import { AnnouncementDeleteButton } from "@/components/announcements/announcement-delete-button";
import { DataTable, type DataTableColumnDef } from "@/components/data-table/data-table";
import { DateDisplay } from "@/components/jalali/date-display";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

export type AnnouncementRow = {
  id: number;
  title: string;
  body: string;
  authorName: string;
  departmentName: string | null;
  isPinned: boolean;
  createdAt: Date | string;
  read: number;
  total: number;
};

type Props = {
  rows: AnnouncementRow[];
};

export function AnnouncementsDataTable({ rows }: Props) {
  const columns: DataTableColumnDef<AnnouncementRow>[] = [
    {
      accessorKey: "title",
      meta: { label: "عنوان" },
      header: "عنوان",
      cell: ({ row }) => (
        <div className="flex max-w-xs flex-wrap items-center gap-1.5">
          <span className="font-medium">{row.original.title}</span>
          {row.original.isPinned ? (
            <Badge variant="info" className="text-[10px]">
              سنجاق
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "authorName",
      meta: { label: "نویسنده" },
      header: "نویسنده",
    },
    {
      id: "createdAt",
      meta: { label: "تاریخ" },
      header: "تاریخ",
      cell: ({ row }) => (
        <DateDisplay value={row.original.createdAt} pattern="yyyy/MM/dd" />
      ),
    },
    {
      id: "reads",
      meta: { label: "خوانده" },
      header: "خوانده",
      cell: ({ row }) => {
        const { read, total } = row.original;
        const pct = total === 0 ? 0 : Math.round((read / total) * 100);
        return (
          <div className="min-w-28 space-y-1">
            <span className="text-xs tabular-nums">
              {toFaDigits(read)}/{toFaDigits(total)}
            </span>
            <Progress value={pct} className="h-1.5" />
          </div>
        );
      },
    },
    {
      id: "actions",
      meta: { label: "عملیات", hideable: false },
      enableHiding: false,
      header: "عملیات",
      cell: ({ row }) => <AnnouncementDeleteButton id={row.original.id} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.id)}
      emptyMessage={fa.common.empty}
      renderMobileCard={(row) => {
        const unread = Math.max(0, row.total - row.read);
        const pct =
          row.total === 0 ? 0 : Math.round((row.read / row.total) * 100);
        return (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-1.5 font-medium">
                  {row.title}
                  {row.isPinned ? (
                    <Badge variant="info" className="text-[10px]">
                      سنجاق
                    </Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {row.authorName} ·{" "}
                  <DateDisplay value={row.createdAt} pattern="yyyy/MM/dd" />
                  {row.departmentName ? ` · ${row.departmentName}` : ""}
                </p>
              </div>
              <AnnouncementDeleteButton id={row.id} />
            </div>
            <p className="line-clamp-3 text-sm whitespace-pre-wrap">{row.body}</p>
            <div className="space-y-1">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>
                  خوانده: {toFaDigits(row.read)}/{toFaDigits(row.total)}
                </span>
                <span>نخوانده: {toFaDigits(unread)}</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          </div>
        );
      }}
    />
  );
}
