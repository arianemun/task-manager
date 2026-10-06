"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JalaliMultiDatePicker } from "@/components/jalali/jalali-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/server/actions/auth";
import { createHolidaysAction } from "@/server/actions/holidays";

const initial: ActionResult | null = null;

export function HolidayForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createHolidaysAction, initial);
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    if (state?.ok) {
      setDates([]);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">عنوان تعطیل</Label>
        <Input id="title" name="title" required disabled={pending} />
      </div>
      <JalaliMultiDatePicker
        name="dates"
        label="تاریخ‌ها (شمسی — چند روزه)"
        values={dates}
        onChange={setDates}
        disabled={pending}
      />
      {state && !state.ok ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending || dates.length === 0}>
        افزودن تعطیلات
      </Button>
    </form>
  );
}
