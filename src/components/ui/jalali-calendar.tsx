"use client";

import * as React from "react";
import { DayPicker, faIR } from "@daypicker/persian";
import type { ComponentProps } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type JalaliCalendarProps = ComponentProps<typeof DayPicker>;

/**
 * تقویم شمسی مبتنی بر @daypicker/persian + استایل shadcn.
 * هفته از شنبه؛ برچسب‌ها و ارقام فارسی (faIR).
 */
function JalaliCalendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: JalaliCalendarProps) {
  return (
    <DayPicker
      locale={faIR}
      dir="rtl"
      numerals="arabext"
      showOutsideDays={showOutsideDays}
      className={cn("bg-background p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4",
        month: "flex w-full flex-col gap-4",
        month_caption: "flex h-8 w-full items-center justify-center px-8",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 opacity-70 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 opacity-70 hover:opacity-100",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground flex-1 text-center text-[0.8rem] font-normal",
        week: "mt-2 flex w-full",
        day: "relative aspect-square h-full w-full p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100",
        ),
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md",
        today: "bg-accent text-accent-foreground rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        range_start: "bg-primary text-primary-foreground rounded-s-md",
        range_end: "bg-primary text-primary-foreground rounded-e-md",
        range_middle: "bg-accent text-accent-foreground rounded-none",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: c, orientation, ...rest }) => {
          if (orientation === "left") {
            return (
              <ChevronRightIcon
                className={cn("size-4 rtl:rotate-180", c)}
                {...rest}
              />
            );
          }
          if (orientation === "right") {
            return (
              <ChevronLeftIcon
                className={cn("size-4 rtl:rotate-180", c)}
                {...rest}
              />
            );
          }
          return <ChevronDownIcon className={cn("size-4", c)} {...rest} />;
        },
      }}
      {...props}
    />
  );
}

export { JalaliCalendar };
