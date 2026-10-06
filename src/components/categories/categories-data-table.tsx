"use client";

import { useState } from "react";
import { CategoryDeleteButton } from "@/components/categories/category-delete-button";
import { CategoryEditDialog } from "@/components/categories/category-edit-dialog";
import {
  DataTable,
  type DataTableColumnDef,
} from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

export type CategoryRow = {
  id: number;
  name: string;
  color: string;
  taskCount: number;
};

function ColorSwatch({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="size-4 rounded-full border"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-xs" dir="ltr">
        {color}
      </span>
    </span>
  );
}

function CategoryActions({ row }: { row: CategoryRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        ویرایش
      </Button>
      <CategoryEditDialog row={row} open={open} onOpenChange={setOpen} />
      <CategoryDeleteButton id={row.id} disabled={row.taskCount > 0} />
    </div>
  );
}

export function CategoriesDataTable({ rows }: { rows: CategoryRow[] }) {
  const columns: DataTableColumnDef<CategoryRow>[] = [
    {
      accessorKey: "name",
      meta: { label: "نام" },
      header: "نام",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "color",
      meta: { label: "رنگ" },
      header: "رنگ",
      cell: ({ row }) => <ColorSwatch color={row.original.color} />,
    },
    {
      accessorKey: "taskCount",
      meta: { label: "کارها" },
      header: "کارها",
      cell: ({ row }) => toFaDigits(row.original.taskCount),
    },
    {
      id: "actions",
      meta: { label: "عملیات", hideable: false },
      enableHiding: false,
      header: "عملیات",
      cell: ({ row }) => <CategoryActions row={row.original} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.id)}
      emptyMessage={fa.common.empty}
      renderMobileCard={(row) => (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium">{row.name}</p>
              <ColorSwatch color={row.color} />
              <p className="text-muted-foreground text-sm">
                کارها: {toFaDigits(row.taskCount)}
              </p>
            </div>
          </div>
          <CategoryActions row={row} />
        </div>
      )}
    />
  );
}
