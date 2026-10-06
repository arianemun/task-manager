"use client";

import { useState } from "react";
import { ReasonDeleteButton } from "@/components/reasons/reason-delete-button";
import { ReasonEditDialog } from "@/components/reasons/reason-edit-dialog";
import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

export type ReasonRow = {
  id: number;
  label: string;
  departmentIds: number[];
  departmentNames: string[];
  usageCount: number;
};

function ReasonActions({
  row,
  departments,
}: {
  row: ReasonRow;
  departments: Array<{ id: number; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        ویرایش
      </Button>
      <ReasonEditDialog
        row={row}
        departments={departments}
        open={open}
        onOpenChange={setOpen}
      />
      <ReasonDeleteButton id={row.id} disabled={row.usageCount > 0} />
    </div>
  );
}

export function ReasonsDataTable({
  rows,
  departments,
}: {
  rows: ReasonRow[];
  departments: Array<{ id: number; name: string }>;
}) {
  const columns: DataTableColumnDef<ReasonRow>[] = [
    {
      accessorKey: "label",
      meta: { label: "عنوان" },
      header: "عنوان",
      cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
    },
    {
      id: "departments",
      meta: { label: "دپارتمان‌ها" },
      header: "دپارتمان‌ها",
      cell: ({ row }) =>
        row.original.departmentNames.length === 0
          ? "همه"
          : row.original.departmentNames.join("، "),
    },
    {
      accessorKey: "usageCount",
      meta: { label: "استفاده" },
      header: "استفاده",
      cell: ({ row }) => toFaDigits(row.original.usageCount),
    },
    {
      id: "actions",
      meta: { label: "عملیات", hideable: false },
      enableHiding: false,
      header: "عملیات",
      cell: ({ row }) => (
        <ReasonActions row={row.original} departments={departments} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => String(row.id)}
      emptyMessage={fa.common.empty}
      renderMobileCard={(row) => (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-medium">{row.label}</p>
            <p className="text-muted-foreground text-sm">
              {row.departmentNames.length === 0
                ? "همه دپارتمان‌ها"
                : row.departmentNames.join("، ")}
            </p>
            <p className="text-muted-foreground text-sm">
              استفاده: {toFaDigits(row.usageCount)}
            </p>
          </div>
          <ReasonActions row={row} departments={departments} />
        </div>
      )}
    />
  );
}
