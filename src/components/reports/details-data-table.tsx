"use client";

import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { fa } from "@/lib/i18n/fa";
import { toJalali, type GDate } from "@/lib/dates";
import { toFaDigits } from "@/lib/utils";

export type DetailRow = {
  id: number;
  fullName: string;
  title: string;
  periodEnd: string | Date;
  status: string;
  reasonCode: string | null;
  reasonLabel?: string | null;
  note: string | null;
  completedByName?: string | null;
};

function periodEndAsGDate(value: string | Date): GDate {
  if (typeof value === "string") return value.slice(0, 10) as GDate;
  return value.toISOString().slice(0, 10) as GDate;
}

function formatPeriodEnd(value: string | Date): string {
  return toFaDigits(toJalali(periodEndAsGDate(value)).jDate);
}

type Props = {
  rows: DetailRow[];
  total: number;
  page: number;
  pageSize: number;
  countable: number;
};

const columns: DataTableColumnDef<DetailRow>[] = [
  {
    accessorKey: "fullName",
    meta: { label: "پرسنل" },
    header: "پرسنل",
    cell: ({ row }) => row.original.fullName,
    renderMobileCard: (row) => (
      <div className="space-y-1.5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{row.fullName}</span>
          <Badge variant="outline">
            {fa.status[row.status as keyof typeof fa.status] ?? row.status}
          </Badge>
        </div>
        <p>{row.title}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          پایان: {formatPeriodEnd(row.periodEnd)}
        </p>
        {row.completedByName && row.completedByName !== row.fullName ? (
          <p className="text-muted-foreground text-xs">
            ثبت توسط {row.completedByName}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {row.reasonLabel ?? row.reasonCode ?? row.note ?? "—"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "title",
    meta: { label: "کار" },
    header: "کار",
    cell: ({ row }) => row.original.title,
  },
  {
    id: "periodEnd",
    meta: { label: "پایان دوره" },
    header: "پایان دوره",
    cell: ({ row }) => formatPeriodEnd(row.original.periodEnd),
  },
  {
    accessorKey: "status",
    meta: { label: "وضعیت" },
    header: "وضعیت",
    cell: ({ row }) => {
      const status =
        fa.status[row.original.status as keyof typeof fa.status] ??
        row.original.status;
      const by = row.original.completedByName;
      if (by && by !== row.original.fullName) {
        return `${status} · ${by}`;
      }
      return status;
    },
  },
  {
    id: "reason",
    meta: { label: "دلیل" },
    header: "دلیل",
    cell: ({ row }) =>
      row.original.reasonLabel ?? row.original.reasonCode ?? row.original.note ?? "—",
  },
];

export function DetailsDataTable({
  rows,
  total,
  page,
  pageSize,
  countable,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        KPI قابل‌شمارش این فیلتر: {toFaDigits(countable)} — باید با جمع
        ردیف‌های غیر PENDING/EXCUSED هم‌خوان باشد.
      </p>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => String(r.id)}
        emptyMessage="ردیفی در این بازه نیست"
        footer={
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            defaultPageSize={25}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        }
      />
    </div>
  );
}
