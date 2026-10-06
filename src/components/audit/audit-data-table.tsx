"use client";

import { DataTable, type DataTableColumnDef } from "@/components/data-table/data-table";
import { DataTableFilters } from "@/components/data-table/data-table-filters";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DateDisplay } from "@/components/jalali/date-display";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { fa } from "@/lib/i18n/fa";
import { toFaDigits } from "@/lib/utils";

export type AuditRow = {
  id: number;
  createdAt: Date | string;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: number | string | null;
  meta: unknown;
};

type Props = {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  actions: readonly string[];
  staff: Array<{ id: number; fullName: string }>;
};

function MetaCollapsible({ meta }: { meta: unknown }) {
  if (meta == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const text =
    typeof meta === "string" ? meta : JSON.stringify(meta, null, 2);
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="group h-auto gap-1 px-2 py-1 text-xs"
          aria-label="نمایش جزئیات"
        >
          جزئیات
          <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre
          className="bg-muted/50 mt-1 max-h-40 overflow-auto rounded-md p-2 text-start text-xs whitespace-pre-wrap"
          dir="ltr"
        >
          {text}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

const columns: DataTableColumnDef<AuditRow>[] = [
  {
    accessorKey: "createdAt",
    meta: { label: "زمان" },
    header: "زمان",
    cell: ({ row }) => (
      <DateDisplay
        value={row.original.createdAt}
        pattern="yyyy/MM/dd HH:mm"
      />
    ),
    renderMobileCard: (row) => (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <DateDisplay value={row.createdAt} pattern="yyyy/MM/dd HH:mm" />
          <span className="font-mono text-xs">{row.action}</span>
        </div>
        <p>
          <span className="text-muted-foreground">کاربر: </span>
          {row.actorName ?? "—"}
        </p>
        <p>
          <span className="text-muted-foreground">موجودیت: </span>
          {row.entity}
          {row.entityId != null ? ` #${toFaDigits(row.entityId)}` : ""}
        </p>
        <MetaCollapsible meta={row.meta} />
      </div>
    ),
  },
  {
    accessorKey: "actorName",
    meta: { label: "کاربر" },
    header: "کاربر",
    cell: ({ row }) => row.original.actorName ?? "—",
  },
  {
    accessorKey: "action",
    meta: { label: "عملیات" },
    header: "عملیات",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.action}</span>
    ),
  },
  {
    id: "entity",
    meta: { label: "موجودیت" },
    header: "موجودیت",
    cell: ({ row }) => (
      <>
        {row.original.entity}
        {row.original.entityId != null
          ? ` #${row.original.entityId}`
          : ""}
      </>
    ),
  },
  {
    id: "meta",
    meta: { label: "جزئیات" },
    header: "جزئیات",
    cell: ({ row }) => <MetaCollapsible meta={row.original.meta} />,
  },
];

export function AuditDataTable({
  rows,
  total,
  page,
  pageSize,
  actions,
  staff,
}: Props) {
  const fields = [
    {
      type: "select" as const,
      name: "actorId",
      label: "کاربر",
      placeholder: "همه کاربران",
      options: staff.map((s) => ({
        value: String(s.id),
        label: s.fullName,
      })),
    },
    {
      type: "select" as const,
      name: "action",
      label: "عملیات",
      placeholder: "همه عملیات",
      options: actions.map((a) => ({ value: a, label: a })),
    },
    {
      type: "search" as const,
      name: "from",
      label: "از تاریخ",
      placeholder: "YYYY-MM-DD",
    },
    {
      type: "search" as const,
      name: "to",
      label: "تا تاریخ",
      placeholder: "YYYY-MM-DD",
    },
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
          activeParamNames={["actorId", "action", "from", "to"]}
        />
      }
      footer={
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          defaultPageSize={30}
          pageSizeOptions={[10, 20, 30, 50, 100]}
        />
      }
    />
  );
}
