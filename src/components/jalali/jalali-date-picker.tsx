"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { JalaliCalendar } from "@/components/ui/jalali-calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { useIsDesktop } from "@/hooks/use-media-query";
import {
  gDateToPickerDate,
  pickerDateToGDate,
} from "@/lib/dates/picker";
import type { GDate } from "@/lib/dates";
import { toJalali } from "@/lib/dates";
import { toFaDigits } from "@/lib/utils";
import { cn } from "@/lib/utils";

function formatDisplay(g: GDate | null | undefined): string {
  if (!g) return "انتخاب تاریخ";
  return toFaDigits(toJalali(g).jDate.replace(/-/g, "/"));
}

type SingleProps = {
  name?: string;
  label?: string;
  value?: string | null;
  required?: boolean;
  disabled?: boolean;
  disabledDates?: (date: Date) => boolean;
  onChange?: (gDate: string | null) => void;
  className?: string;
};

export function JalaliDatePicker({
  name,
  label,
  value,
  required,
  disabled,
  disabledDates,
  onChange,
  className,
}: SingleProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useIsDesktop();
  const selected = value ? gDateToPickerDate(value) : undefined;

  function select(d: Date | undefined) {
    const g = d ? pickerDateToGDate(d) : null;
    onChange?.(g);
    setOpen(false);
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(
        "h-9 w-full justify-start gap-2 text-start font-normal",
        !value && "text-muted-foreground",
        className,
      )}
    >
      <CalendarIcon className="size-4 opacity-60" />
      <span className="truncate">{formatDisplay(value)}</span>
    </Button>
  );

  const calendar = (
    <JalaliCalendar
      mode="single"
      selected={selected}
      onSelect={select}
      disabled={disabledDates}
      defaultMonth={selected}
    />
  );

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      {isDesktop ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            {calendar}
          </PopoverContent>
        </Popover>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="h-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-4 py-2">
              <DrawerTitle>{label ?? "انتخاب تاریخ"}</DrawerTitle>
            </DrawerHeader>
            <div className="px-2 pb-2">{calendar}</div>
          </DrawerContent>
        </Drawer>
      )}
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value ?? ""}
          required={required}
        />
      ) : null}
    </div>
  );
}

type RangeProps = {
  from?: string | null;
  to?: string | null;
  onChange?: (range: { from: string | null; to: string | null }) => void;
  shortcuts?: Array<{
    id: string;
    label: string;
    onSelect: () => { from: string; to: string };
  }>;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function JalaliDateRangePicker({
  from,
  to,
  onChange,
  shortcuts,
  label,
  disabled,
  className,
}: RangeProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useIsDesktop();
  const selected: DateRange | undefined =
    from || to
      ? {
          from: from ? gDateToPickerDate(from) : undefined,
          to: to ? gDateToPickerDate(to) : undefined,
        }
      : undefined;

  function applyRange(r: DateRange | undefined) {
    onChange?.({
      from: r?.from ? pickerDateToGDate(r.from) : null,
      to: r?.to ? pickerDateToGDate(r.to) : null,
    });
  }

  const display =
    from && to
      ? `${formatDisplay(from)} – ${formatDisplay(to)}`
      : from
        ? `${formatDisplay(from)} – …`
        : "انتخاب بازه";

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className={cn(
        "h-9 w-full justify-start gap-2 text-start font-normal",
        !from && "text-muted-foreground",
        className,
      )}
    >
      <CalendarIcon className="size-4 opacity-60" />
      <span className="truncate">{display}</span>
    </Button>
  );

  const body = (
    <div className="flex flex-col gap-2 p-2 sm:flex-row">
      {shortcuts && shortcuts.length > 0 ? (
        <div className="flex flex-row flex-wrap gap-1 border-b pb-2 sm:w-36 sm:flex-col sm:border-b-0 sm:border-e sm:pb-0 sm:pe-2">
          {shortcuts.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant="ghost"
              className="justify-start"
              onClick={() => {
                const next = s.onSelect();
                onChange?.(next);
                setOpen(false);
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
      ) : null}
      <JalaliCalendar
        mode="range"
        selected={selected}
        onSelect={applyRange}
        defaultMonth={selected?.from}
        numberOfMonths={isDesktop ? 2 : 1}
      />
    </div>
  );

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      {isDesktop ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {body}
          </PopoverContent>
        </Popover>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="h-auto max-h-[92dvh] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-4 py-2">
              <DrawerTitle>{label ?? "انتخاب بازه"}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-2 pb-2">{body}</div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

type MultiProps = {
  name?: string;
  label?: string;
  /** لیست GDate */
  values?: string[];
  onChange?: (dates: string[]) => void;
  disabled?: boolean;
};

/** چند روز جدا — برای تعطیلات */
export function JalaliMultiDatePicker({
  name,
  label,
  values = [],
  onChange,
  disabled,
}: MultiProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useIsDesktop();
  const selected = values.map(gDateToPickerDate);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className="h-9 w-full justify-start gap-2 text-start font-normal"
    >
      <CalendarIcon className="size-4 opacity-60" />
      <span className="truncate">
        {values.length
          ? `${toFaDigits(values.length)} روز انتخاب‌شده`
          : "انتخاب یک یا چند روز"}
      </span>
    </Button>
  );

  const calendar = (
    <JalaliCalendar
      mode="multiple"
      selected={selected}
      onSelect={(dates) => {
        const next = (dates ?? []).map(pickerDateToGDate).sort();
        onChange?.(next);
      }}
    />
  );

  const payload = values.join(",");

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      {isDesktop ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            {calendar}
            <div className="border-t p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                تأیید
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="h-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-4 py-2">
              <DrawerTitle>{label ?? "انتخاب تاریخ‌ها"}</DrawerTitle>
            </DrawerHeader>
            <div className="px-2 pb-2">{calendar}</div>
            <div className="border-t p-3">
              <Button
                type="button"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                تأیید
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      )}
      {name ? <input type="hidden" name={name} value={payload} /> : null}
    </div>
  );
}
