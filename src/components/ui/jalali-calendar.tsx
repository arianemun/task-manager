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
      className={cn("w-full min-w-[17.5rem] bg-background p-2", className)}
      classNames={{
        months: "relative flex w-full flex-col gap-2",
        month: "flex w-full flex-col gap-2",
        month_caption: "flex h-9 w-full items-center justify-center px-10",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex h-9 w-full items-center justify-between px-1",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 opacity-70 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 opacity-70 hover:opacity-100",
        ),
        month_grid: "w-full table-fixed border-collapse",
        weekdays: "",
        weekday:
          "text-muted-foreground h-8 p-0 text-center text-[0.8rem] font-normal",
        week: "",
        day: "relative h-10 p-0 text-center align-middle text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "mx-auto size-9 p-0 font-normal aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:rounded-md",
        today:
          "[&>button]:bg-accent [&>button]:text-accent-foreground [&>button]:rounded-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        range_start:
          "bg-accent rounded-s-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:rounded-md",
        range_end:
          "bg-accent rounded-e-md [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:rounded-md",
        range_middle: "bg-accent text-accent-foreground rounded-none",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: c, orientation, ...rest }) => {
          if (orientation === "left") {
            return <ChevronRightIcon className={cn("size-4", c)} {...rest} />;
          }
          if (orientation === "right") {
            return <ChevronLeftIcon className={cn("size-4", c)} {...rest} />;
          }
          return <ChevronDownIcon className={cn("size-4", c)} {...rest} />;
        },
      }}
      {...props}
    />
  );
}

export { JalaliCalendar };
