"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFaDigits } from "@/lib/utils";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
};

export function DataTablePagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 20, 30, 50],
  defaultPageSize = 20,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  function push(nextPage: number, nextSize = pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    if (nextSize === defaultPageSize) params.delete("pageSize");
    else params.set("pageSize", String(nextSize));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  if (total === 0) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-sm tabular-nums">
        {toFaDigits(total)} مورد · صفحه {toFaDigits(page)} از{" "}
        {toFaDigits(totalPages)}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">ردیف</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => push(1, Number(v))}
          >
            <SelectTrigger
              className="h-8 w-[4.5rem]"
              aria-label="تعداد ردیف در صفحه"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {toFaDigits(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => push(page - 1)}
          aria-label="صفحه قبل"
        >
          <ChevronRight className="size-4" />
          قبلی
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => push(page + 1)}
          aria-label="صفحه بعد"
        >
          بعدی
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}
