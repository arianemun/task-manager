"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { countUniqueAssigneesAction } from "@/server/actions/tasks";
import { normalizePersianText } from "@/lib/validation/normalize";
import { cn } from "@/lib/utils";

export type StaffOption = {
  id: number;
  fullName: string;
  departmentId: number | null;
};
export type DeptOption = { id: number; name: string };

type Props = {
  staff: StaffOption[];
  departments: DeptOption[];
  initialUserIds?: number[];
  initialDepartmentIds?: number[];
  managerLockedDeptId?: number | null;
};

export function AssigneePicker({
  staff,
  departments,
  initialUserIds = [],
  initialDepartmentIds = [],
  managerLockedDeptId = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [userIds, setUserIds] = useState<number[]>(initialUserIds);
  const [departmentIds, setDepartmentIds] = useState<number[]>(
    managerLockedDeptId ? [managerLockedDeptId] : initialDepartmentIds,
  );
  const [uniqueCount, setUniqueCount] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const n = await countUniqueAssigneesAction(userIds, departmentIds);
      setUniqueCount(n);
    });
  }, [userIds, departmentIds]);

  const filtered = useMemo(() => {
    const needle = normalizePersianText(q);
    if (!needle) return staff.slice(0, 40);
    return staff
      .filter((s) => {
        const name = normalizePersianText(s.fullName);
        return name.includes(needle) || String(s.id).includes(needle);
      })
      .slice(0, 40);
  }, [q, staff]);

  const selectedStaff = staff.filter((s) => userIds.includes(s.id));

  function toggleUser(id: number) {
    setUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleDept(id: number) {
    if (managerLockedDeptId != null) return;
    setDepartmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-base">گیرندگان</Label>
        <Badge variant="secondary">
          تعداد نهایی افراد: {pending ? "…" : uniqueCount}
        </Badge>
      </div>

      <input type="hidden" name="userIds" value={JSON.stringify(userIds)} />
      <input
        type="hidden"
        name="departmentIds"
        value={JSON.stringify(departmentIds)}
      />

      <div className="space-y-2">
        <Label>جستجوی پرسنل</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-9 w-full justify-between font-normal"
            >
              <span className="truncate text-muted-foreground">
                {selectedStaff.length
                  ? `${selectedStaff.length} نفر انتخاب‌شده`
                  : "جستجو و انتخاب پرسنل…"}
              </span>
              <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="نام پرسنل…"
                value={q}
                onValueChange={setQ}
              />
              <CommandList>
                <CommandEmpty>موردی نیست</CommandEmpty>
                <CommandGroup>
                  {filtered.map((s) => {
                    const on = userIds.includes(s.id);
                    return (
                      <CommandItem
                        key={s.id}
                        value={String(s.id)}
                        onSelect={() => toggleUser(s.id)}
                      >
                        <Check
                          className={cn(
                            "size-4",
                            on ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {s.fullName}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedStaff.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedStaff.map((s) => (
              <Badge key={s.id} variant="outline" className="gap-1">
                {s.fullName}
                <button type="button" onClick={() => toggleUser(s.id)}>
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>دپارتمان‌ها</Label>
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => {
            const on = departmentIds.includes(d.id);
            const locked =
              managerLockedDeptId != null && d.id === managerLockedDeptId;
            return (
              <button
                key={d.id}
                type="button"
                disabled={managerLockedDeptId != null && !locked}
                onClick={() => toggleDept(d.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  on
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent",
                  "disabled:opacity-50",
                )}
              >
                {d.name}
                {locked ? " (دپارتمان شما)" : ""}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
