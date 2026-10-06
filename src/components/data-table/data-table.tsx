"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { Columns3, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumnMeta = {
  label?: string;
  /** مخفی‌کردن از انتخابگر ستون */
  hideable?: boolean;
};

export type DataTableColumnDef<TData> = ColumnDef<TData, unknown> & {
  meta?: DataTableColumnMeta;
  /** کارت موبایل — اگر روی هر ستون تعریف شود، اولین تابع غیرخالی استفاده می‌شود */
  renderMobileCard?: (row: TData) => React.ReactNode;
};

type RowAction = {
  key: string;
  label: string;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
};

type Props<TData> = {
  columns: DataTableColumnDef<TData>[];
  data: TData[];
  /** کلید پایدار ردیف */
  getRowId?: (row: TData) => string;
  /** اکشن‌های هر ردیف برای منوی ⋯ */
  getRowActions?: (row: TData) => RowAction[];
  /** رندر کارت موبایل سراسری (اولویت بالاتر از ستون) */
  renderMobileCard?: (row: TData) => React.ReactNode;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  getRowActions,
  renderMobileCard,
  emptyMessage = "موردی یافت نشد",
  toolbar,
  footer,
  className,
}: Props<TData>) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const cols = React.useMemo(() => {
    if (!getRowActions) return columns;
    const actionsCol: DataTableColumnDef<TData> = {
      id: "_actions",
      enableHiding: false,
      meta: { label: "عملیات", hideable: false },
      header: () => <span className="sr-only">عملیات</span>,
      cell: ({ row }) => {
        const actions = getRowActions(row.original);
        if (!actions.length) return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="عملیات ردیف"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((a) =>
                a.href ? (
                  <DropdownMenuItem key={a.key} asChild>
                    <a
                      href={a.href}
                      className={a.destructive ? "text-destructive" : undefined}
                    >
                      {a.label}
                    </a>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    key={a.key}
                    variant={a.destructive ? "destructive" : "default"}
                    onSelect={a.onSelect}
                  >
                    {a.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    };
    return [...columns, actionsCol];
  }, [columns, getRowActions]);

  const table = useReactTable({
    data,
    columns: cols,
    getCoreRowModel: getCoreRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { columnVisibility },
    getRowId: getRowId
      ? (row, index) => getRowId(row) ?? String(index)
      : undefined,
  });

  const mobileRenderer =
    renderMobileCard ??
    columns.find((c) => c.renderMobileCard)?.renderMobileCard;

  const hideableColumns = table
    .getAllColumns()
    .filter(
      (c) =>
        c.getCanHide() &&
        (c.columnDef as DataTableColumnDef<TData>).meta?.hideable !== false &&
        c.id !== "_actions",
    );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">{toolbar}</div>
        {hideableColumns.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                aria-label="نمایش ستون‌ها"
              >
                <Columns3 className="size-4" />
                ستون‌ها
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>نمایش ستون‌ها</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideableColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                >
                  {(column.columnDef as DataTableColumnDef<TData>).meta
                    ?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* دسکتاپ: جدول */}
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={cols.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* موبایل: کارت */}
      <div className="space-y-3 md:hidden">
        {data.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            {emptyMessage}
          </p>
        ) : (
          data.map((row, i) => {
            const id = getRowId?.(row) ?? String(i);
            const actions = getRowActions?.(row) ?? [];
            return (
              <div
                key={id}
                className="bg-card space-y-2 rounded-xl border p-4"
              >
                {mobileRenderer ? (
                  mobileRenderer(row)
                ) : (
                  <pre className="text-xs">{JSON.stringify(row, null, 2)}</pre>
                )}
                {actions.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {actions.map((a) =>
                      a.href ? (
                        <Button
                          key={a.key}
                          asChild
                          size="sm"
                          variant={a.destructive ? "destructive" : "outline"}
                        >
                          <a href={a.href}>{a.label}</a>
                        </Button>
                      ) : (
                        <Button
                          key={a.key}
                          type="button"
                          size="sm"
                          variant={a.destructive ? "destructive" : "outline"}
                          onClick={a.onSelect}
                        >
                          {a.label}
                        </Button>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {footer}
    </div>
  );
}
