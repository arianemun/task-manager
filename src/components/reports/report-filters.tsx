"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, X } from "lucide-react";
import { JalaliDateRangePicker } from "@/components/jalali/jalali-date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { fa } from "@/lib/i18n/fa";
import { resolveReportRange, type ReportFilters } from "@/lib/reports";
import { toFaDigits } from "@/lib/utils";

type Opt = { id: number; name: string; fullName?: string };

type Props = {
  filters: ReportFilters;
  departments: Opt[];
  staff: Opt[];
  categories: Opt[];
  showDepartment?: boolean;
  lockUserId?: number | null;
};

const SHORTCUTS: Array<{ id: ReportFilters["shortcut"]; label: string }> = [
  { id: "today", label: "امروز" },
  { id: "week", label: "این هفته" },
  { id: "month", label: "این ماه" },
  { id: "last_month", label: "ماه قبل" },
  { id: "last_3_months", label: "۳ ماه اخیر" },
  { id: "custom", label: "دلخواه" },
];

function countActiveFilters(
  filters: ReportFilters,
  showDepartment: boolean,
  lockUserId: number | null,
): number {
  let n = 0;
  if (filters.shortcut !== "month") n += 1;
  if (showDepartment && filters.departmentId) n += 1;
  if (!lockUserId && filters.userId) n += 1;
  if (filters.categoryId) n += 1;
  if (filters.recurrenceType) n += 1;
  if (filters.priority) n += 1;
  if (filters.q?.trim()) n += 1;
  return n;
}

export function ReportFiltersBar({
  filters,
  departments,
  staff,
  categories,
  showDepartment = true,
  lockUserId = null,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = React.useState(false);

  const activeCount = countActiveFilters(filters, showDepartment, lockUserId);

  function push(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  function clearFilters() {
    const params = new URLSearchParams(sp.toString());
    for (const k of [
      "range",
      "from",
      "to",
      "departmentId",
      "userId",
      "categoryId",
      "recurrenceType",
      "priority",
      "q",
      "page",
    ]) {
      params.delete(k);
    }
    params.set("range", "month");
    start(() => router.push(`${pathname}?${params.toString()}`));
    setOpen(false);
  }

  const fields = (
    <FilterFields
      filters={filters}
      departments={departments}
      staff={staff}
      categories={categories}
      showDepartment={showDepartment}
      lockUserId={lockUserId}
      pending={pending}
      push={push}
    />
  );

  return (
    <div className="report-filters print:hidden space-y-3">
      {/* دسکتاپ: فیلترهای inline — یک نمونه در DOM */}
      <div className="hidden space-y-3 rounded-xl border p-4 md:block">
        {fields}
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            aria-label="پاک کردن فیلترها"
          >
            <X className="size-4" />
            پاک کردن فیلترها
          </Button>
        ) : null}
      </div>

      {/* موبایل: Sheet؛ فیلدها فقط وقتی باز است mount می‌شوند */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              aria-label="فیلترها"
            >
              <Filter className="size-4" />
              فیلترها
              {activeCount > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {toFaDigits(activeCount)}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="bg-background max-h-[85dvh] rounded-t-xl"
          >
            <SheetHeader>
              <SheetTitle>فیلتر گزارش</SheetTitle>
            </SheetHeader>
            {open ? (
              <div className="space-y-4 overflow-y-auto px-4 py-2">{fields}</div>
            ) : null}
            <SheetFooter>
              {activeCount > 0 ? (
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  پاک کردن فیلترها
                </Button>
              ) : null}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function FilterFields({
  filters,
  departments,
  staff,
  categories,
  showDepartment,
  lockUserId,
  pending,
  push,
}: {
  filters: ReportFilters;
  departments: Opt[];
  staff: Opt[];
  categories: Opt[];
  showDepartment: boolean;
  lockUserId: number | null;
  pending: boolean;
  push: (next: Record<string, string | null>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map((s) => (
          <Button
            key={s.id}
            type="button"
            size="sm"
            variant={filters.shortcut === s.id ? "default" : "outline"}
            disabled={pending}
            onClick={() => push({ range: s.id })}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {filters.shortcut === "custom" ? (
        <JalaliDateRangePicker
          label="بازه دلخواه"
          from={filters.from}
          to={filters.to}
          onChange={(r) => {
            if (r.from && r.to) {
              push({ range: "custom", from: r.from, to: r.to });
            }
          }}
          shortcuts={SHORTCUTS.filter((s) => s.id !== "custom").map((s) => ({
            id: s.id,
            label: s.label,
            onSelect: () => {
              const r = resolveReportRange(s.id);
              push({ range: s.id, from: null, to: null });
              return { from: r.from, to: r.to };
            },
          }))}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {showDepartment ? (
          <div className="space-y-1">
            <Label>دپارتمان</Label>
            <Select
              value={
                filters.departmentId ? String(filters.departmentId) : "__all__"
              }
              onValueChange={(v) =>
                push({ departmentId: v === "__all__" ? null : v })
              }
            >
              <SelectTrigger aria-label="دپارتمان">
                <SelectValue placeholder="همه" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">همه</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {!lockUserId ? (
          <div className="space-y-1">
            <Label>پرسنل</Label>
            <Select
              value={filters.userId ? String(filters.userId) : "__all__"}
              onValueChange={(v) =>
                push({ userId: v === "__all__" ? null : v })
              }
            >
              <SelectTrigger aria-label="پرسنل">
                <SelectValue placeholder="همه" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">همه</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.fullName ?? s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label>دسته</Label>
          <Select
            value={filters.categoryId ? String(filters.categoryId) : "__all__"}
            onValueChange={(v) =>
              push({ categoryId: v === "__all__" ? null : v })
            }
          >
            <SelectTrigger aria-label="دسته">
              <SelectValue placeholder="همه" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">همه</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>نوع تکرار</Label>
          <Select
            value={filters.recurrenceType ?? "__all__"}
            onValueChange={(v) =>
              push({ recurrenceType: v === "__all__" ? null : v })
            }
          >
            <SelectTrigger aria-label="نوع تکرار">
              <SelectValue placeholder="همه" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">همه</SelectItem>
              {Object.entries(fa.recurrence).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>اولویت</Label>
          <Select
            value={filters.priority ?? "__all__"}
            onValueChange={(v) =>
              push({ priority: v === "__all__" ? null : v })
            }
          >
            <SelectTrigger aria-label="اولویت">
              <SelectValue placeholder="همه" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">همه</SelectItem>
              {Object.entries(fa.priority).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="جستجو در جزئیات…"
          defaultValue={filters.q}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              push({
                q: (e.target as HTMLInputElement).value || null,
                page: "1",
              });
            }
          }}
        />
      </div>
    </div>
  );
}
