"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
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
import { toFaDigits } from "@/lib/utils";

export type FilterField =
  | {
      type: "search";
      name: string;
      label?: string;
      placeholder?: string;
    }
  | {
      type: "select";
      name: string;
      label: string;
      placeholder?: string;
      options: Array<{ value: string; label: string }>;
      emptyValue?: string;
    };

type Props = {
  fields: FilterField[];
  activeParamNames?: string[];
  defaultValues?: Record<string, string>;
  children?: React.ReactNode;
};

export function DataTableFilters({
  fields,
  activeParamNames,
  defaultValues = {},
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const current = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of fields) {
      map[f.name] = searchParams.get(f.name) ?? defaultValues[f.name] ?? "";
    }
    return map;
  }, [fields, searchParams, defaultValues]);

  const activeCount = React.useMemo(() => {
    const names = activeParamNames ?? fields.map((f) => f.name);
    let n = 0;
    for (const name of names) {
      const v = (searchParams.get(name) ?? "").trim();
      const def = defaultValues[name] ?? "";
      if (name === "q") {
        if (v) n += 1;
        continue;
      }
      if (v && v !== def) n += 1;
    }
    return n;
  }, [activeParamNames, fields, searchParams, defaultValues]);

  function apply(values: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(values)) {
      const def = defaultValues[k];
      if (!v || (def !== undefined && v === def && k !== "status")) {
        if (def && k === "status") params.set(k, def);
        else if (!v) params.delete(k);
        else params.set(k, v);
      } else {
        params.set(k, v);
      }
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    for (const f of fields) {
      const def = defaultValues[f.name];
      if (def) params.set(f.name, def);
      else params.delete(f.name);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="hidden min-w-0 flex-1 flex-wrap items-end gap-2 md:flex">
        <FilterFields
          fields={fields}
          values={current}
          onSubmit={apply}
          idPrefix="filter"
        />
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            aria-label="پاک کردن فیلترها"
          >
            <X className="size-4" />
            پاک کردن فیلترها
          </Button>
        ) : null}
        {children}
      </div>

      <div className="flex w-full items-center gap-2 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
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
          <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle>فیلترها</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 overflow-y-auto px-4 py-2">
              <FilterFields
                fields={fields}
                values={current}
                onSubmit={apply}
                idPrefix="filter-m"
                stacked
              />
            </div>
            <SheetFooter>
              {activeCount > 0 ? (
                <Button type="button" variant="ghost" onClick={clear}>
                  پاک کردن فیلترها
                </Button>
              ) : null}
            </SheetFooter>
          </SheetContent>
        </Sheet>
        {children}
      </div>
    </div>
  );
}

function FilterFields({
  fields,
  values,
  onSubmit,
  idPrefix,
  stacked,
}: {
  fields: FilterField[];
  values: Record<string, string>;
  onSubmit: (v: Record<string, string>) => void;
  idPrefix: string;
  stacked?: boolean;
}) {
  const [draft, setDraft] = React.useState(values);

  React.useEffect(() => {
    setDraft(values);
  }, [values]);

  return (
    <form
      className={
        stacked ? "flex flex-col gap-3" : "flex flex-wrap items-end gap-2"
      }
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      {fields.map((f) => {
        if (f.type === "search") {
          return (
            <div
              key={f.name}
              className={stacked ? "space-y-1.5" : "min-w-[200px] flex-1"}
            >
              {stacked && f.label ? (
                <Label htmlFor={`${idPrefix}-${f.name}`}>{f.label}</Label>
              ) : null}
              <Input
                id={`${idPrefix}-${f.name}`}
                value={draft[f.name] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [f.name]: e.target.value }))
                }
                placeholder={f.placeholder ?? "جستجو…"}
                className="min-h-9"
              />
            </div>
          );
        }
        const allVal = f.emptyValue ?? "__all__";
        return (
          <div key={f.name} className={stacked ? "space-y-1.5" : "w-[180px]"}>
            <Label
              htmlFor={`${idPrefix}-${f.name}`}
              className={stacked ? undefined : "sr-only"}
            >
              {f.label}
            </Label>
            <Select
              value={draft[f.name] || allVal}
              onValueChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  [f.name]: v === allVal ? "" : v,
                }))
              }
            >
              <SelectTrigger
                id={`${idPrefix}-${f.name}`}
                className="min-h-9 w-full"
                aria-label={f.label}
              >
                <SelectValue placeholder={f.placeholder ?? f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allVal}>
                  {f.placeholder ?? "همه"}
                </SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      <Button type="submit" variant="secondary" className="min-h-9">
        اعمال
      </Button>
    </form>
  );
}
