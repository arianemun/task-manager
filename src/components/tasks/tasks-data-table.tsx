"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumnDef } from "@/components/data-table/data-table";
import { DataTableFilters } from "@/components/data-table/data-table-filters";
import { TaskArchiveButton } from "@/components/tasks/task-archive-button";
import { fa } from "@/lib/i18n/fa";

export type TaskRow = {
  id: number;
  title: string;
  recurrenceSummary: string;
  categoryName: string | null;
  priority: keyof typeof fa.priority;
  isActive: boolean;
  canEdit: boolean;
};

type Props = {
  rows: TaskRow[];
  categories: Array<{ id: number; name: string }>;
  departments: Array<{ id: number; name: string }>;
  showDepartmentFilter: boolean;
};

export function TasksDataTable({
  rows,
  categories,
  departments,
  showDepartmentFilter,
}: Props) {
  const columns: DataTableColumnDef<TaskRow>[] = [
    {
      accessorKey: "title",
      meta: { label: "عنوان" },
      header: "عنوان",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.title}</span>
      ),
      renderMobileCard: (row) => (
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium">{row.title}</p>
            <Badge variant={row.isActive ? "default" : "secondary"}>
              {row.isActive ? "فعال" : "آرشیو"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{row.recurrenceSummary}</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span>{row.categoryName ?? "—"}</span>
            <span>·</span>
            <span>{fa.priority[row.priority]}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/tasks/${row.id}`}>
                {row.canEdit ? "ویرایش" : "مشاهده"}
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/admin/tasks/new?copy=${row.id}`}>کپی</Link>
            </Button>
            {row.canEdit ? (
              <TaskArchiveButton id={row.id} isActive={row.isActive} />
            ) : null}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "recurrenceSummary",
      meta: { label: "الگو" },
      header: "الگو",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.recurrenceSummary}
        </span>
      ),
    },
    {
      accessorKey: "categoryName",
      meta: { label: "دسته" },
      header: "دسته",
      cell: ({ row }) => row.original.categoryName ?? "—",
    },
    {
      accessorKey: "priority",
      meta: { label: "اولویت" },
      header: "اولویت",
      cell: ({ row }) => fa.priority[row.original.priority],
    },
    {
      accessorKey: "isActive",
      meta: { label: "وضعیت" },
      header: "وضعیت",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.original.isActive ? "فعال" : "آرشیو"}
        </Badge>
      ),
    },
    {
      id: "ops",
      meta: { label: "عملیات", hideable: false },
      enableHiding: false,
      header: () => <span className="sr-only">عملیات</span>,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/tasks/${r.id}`}>
                {r.canEdit ? "ویرایش" : "مشاهده"}
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/admin/tasks/new?copy=${r.id}`}>کپی</Link>
            </Button>
            {r.canEdit ? (
              <TaskArchiveButton id={r.id} isActive={r.isActive} />
            ) : null}
          </div>
        );
      },
    },
  ];

  const fields = [
    {
      type: "search" as const,
      name: "q",
      label: "جستجو",
      placeholder: "جستجوی عنوان…",
    },
    {
      type: "select" as const,
      name: "categoryId",
      label: "دسته",
      placeholder: "همه دسته‌ها",
      options: categories.map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    },
    {
      type: "select" as const,
      name: "recurrenceType",
      label: "نوع تکرار",
      placeholder: "همه انواع",
      options: Object.entries(fa.recurrence).map(([k, v]) => ({
        value: k,
        label: v,
      })),
    },
    {
      type: "select" as const,
      name: "status",
      label: "وضعیت",
      placeholder: "وضعیت",
      options: [
        { value: "active", label: "فعال" },
        { value: "archived", label: "آرشیو" },
        { value: "all", label: "همه" },
      ],
    },
    ...(showDepartmentFilter
      ? [
          {
            type: "select" as const,
            name: "departmentId",
            label: "دپارتمان",
            placeholder: "همه دپارتمان‌ها",
            options: departments.map((d) => ({
              value: String(d.id),
              label: d.name,
            })),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.id)}
      emptyMessage={fa.common.empty}
      toolbar={
        <DataTableFilters
          fields={fields}
          defaultValues={{ status: "active" }}
          activeParamNames={[
            "q",
            "categoryId",
            "recurrenceType",
            "status",
            "departmentId",
          ]}
        />
      }
    />
  );
}
