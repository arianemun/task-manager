"use client";

import { DataTable, type DataTableColumnDef } from "@/components/data-table/data-table";
import { HolidayDeleteButton } from "@/components/holidays/holiday-delete-button";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

export type HolidayRow = {
  id: number;
  title: string;
  jalaliDate: string;
  gregorianDate: string;
};

type Props = {
  rows: HolidayRow[];
};

const columns: DataTableColumnDef<HolidayRow>[] = [
  {
    accessorKey: "title",
    meta: { label: "عنوان" },
    header: "عنوان",
    cell: ({ row }) => row.original.title,
    renderMobileCard: (row) => (
      <div className="space-y-2">
        <p className="font-medium">{row.title}</p>
        <p className="text-muted-foreground text-sm">
          شمسی: {toFaDigits(row.jalaliDate)}
        </p>
        <p className="text-muted-foreground text-sm" dir="ltr">
          {row.gregorianDate}
        </p>
        <HolidayDeleteButton id={row.id} />
      </div>
    ),
  },
  {
    accessorKey: "jalaliDate",
    meta: { label: "تاریخ شمسی" },
    header: "تاریخ شمسی",
    cell: ({ row }) => toFaDigits(row.original.jalaliDate),
  },
  {
    accessorKey: "gregorianDate",
    meta: { label: "میلادی" },
    header: "میلادی",
    cell: ({ row }) => (
      <span dir="ltr">{row.original.gregorianDate}</span>
    ),
  },
  {
    id: "ops",
    meta: { label: "عملیات", hideable: false },
    enableHiding: false,
    header: () => <span className="sr-only">عملیات</span>,
    cell: ({ row }) => <HolidayDeleteButton id={row.original.id} />,
  },
];

export function HolidaysDataTable({ rows }: Props) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.id)}
      emptyMessage={fa.common.empty}
    />
  );
}
