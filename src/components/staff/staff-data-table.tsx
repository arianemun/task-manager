"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumnDef } from "@/components/data-table/data-table";
import { DataTableFilters } from "@/components/data-table/data-table-filters";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { fa } from "@/lib/i18n/fa";

export type StaffRow = {
  id: number;
  fullName: string;
  username: string;
  role: keyof typeof fa.roles;
  departmentName: string | null;
  isActive: boolean;
};

type Props = {
  rows: StaffRow[];
  total: number;
  page: number;
  pageSize: number;
  showDepartmentFilter: boolean;
  departments: Array<{ id: number; name: string }>;
};

const columns: DataTableColumnDef<StaffRow>[] = [
  {
    accessorKey: "fullName",
    meta: { label: "نام" },
    header: "نام",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.fullName}</span>
    ),
    renderMobileCard: (row) => (
      <div className="space-y-1">
        <p className="font-medium">{row.fullName}</p>
        <p className="text-muted-foreground text-sm" dir="ltr">
          {row.username}
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <span>{fa.roles[row.role]}</span>
          <span>·</span>
          <span>{row.departmentName ?? "—"}</span>
          <Badge variant={row.isActive ? "success" : "muted"}>
            {row.isActive ? fa.common.active : fa.common.inactive}
          </Badge>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "username",
    meta: { label: "نام کاربری" },
    header: "نام کاربری",
    cell: ({ row }) => (
      <span dir="ltr">{row.original.username}</span>
    ),
  },
  {
    accessorKey: "role",
    meta: { label: "نقش" },
    header: "نقش",
    cell: ({ row }) => fa.roles[row.original.role],
  },
  {
    accessorKey: "departmentName",
    meta: { label: "دپارتمان" },
    header: "دپارتمان",
    cell: ({ row }) => row.original.departmentName ?? "—",
  },
  {
    accessorKey: "isActive",
    meta: { label: "وضعیت" },
    header: "وضعیت",
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? "success" : "muted"}>
        {row.original.isActive ? fa.common.active : fa.common.inactive}
      </Badge>
    ),
  },
];

export function StaffDataTable({
  rows,
  total,
  page,
  pageSize,
  showDepartmentFilter,
  departments,
}: Props) {
  const fields = [
    {
      type: "search" as const,
      name: "q",
      label: "جستجو",
      placeholder: "نام / نام کاربری / موبایل",
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
    {
      type: "select" as const,
      name: "status",
      label: "وضعیت",
      placeholder: "وضعیت",
      options: [
        { value: "active", label: "فعال" },
        { value: "inactive", label: "غیرفعال" },
        { value: "all", label: "همه" },
      ],
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.id)}
      getRowActions={(r) => [
        { key: "view", label: "مشاهده", href: `/admin/staff/${r.id}` },
      ]}
      emptyMessage={fa.common.empty}
      toolbar={
        <DataTableFilters
          fields={fields}
          defaultValues={{ status: "active" }}
          activeParamNames={["q", "departmentId", "status"]}
        />
      }
      footer={
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          defaultPageSize={20}
        />
      }
    />
  );
}
