"use client";

import { DepartmentDeleteButton } from "@/components/departments/department-delete-button";
import { DataTable, type DataTableColumnDef } from "@/components/data-table/data-table";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

export type DepartmentRow = {
  id: number;
  name: string;
  memberCount: number;
};

type Props = {
  rows: DepartmentRow[];
  canDelete: boolean;
};

export function DepartmentsDataTable({ rows, canDelete }: Props) {
  const columns: DataTableColumnDef<DepartmentRow>[] = [
    {
      accessorKey: "name",
      meta: { label: "نام" },
      header: "نام",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "memberCount",
      meta: { label: "اعضا" },
      header: "اعضا",
      cell: ({ row }) => toFaDigits(row.original.memberCount),
    },
    ...(canDelete
      ? [
          {
            id: "actions",
            meta: { label: "عملیات", hideable: false },
            enableHiding: false as const,
            header: "عملیات",
            cell: ({ row }: { row: { original: DepartmentRow } }) => (
              <DepartmentDeleteButton
                id={row.original.id}
                disabled={row.original.memberCount > 0}
              />
            ),
          } satisfies DataTableColumnDef<DepartmentRow>,
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.id)}
      emptyMessage={fa.common.empty}
      renderMobileCard={(row) => (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-medium">{row.name}</p>
            <p className="text-muted-foreground text-sm">
              اعضا: {toFaDigits(row.memberCount)}
            </p>
          </div>
          {canDelete ? (
            <DepartmentDeleteButton
              id={row.id}
              disabled={row.memberCount > 0}
            />
          ) : (
            <span className="text-muted-foreground text-xs">فقط مشاهده</span>
          )}
        </div>
      )}
    />
  );
}
