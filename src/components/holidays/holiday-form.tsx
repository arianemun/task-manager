"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { JalaliMultiDatePicker } from "@/components/jalali/jalali-date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/server/actions/auth";
import { fa } from "@/lib/i18n/fa";
import { useSubmitLock } from "@/lib/ui/submit-lock";
import { createHolidaysAction } from "@/server/actions/holidays";

const initial: ActionResult | null = null;

export function HolidayForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createHolidaysAction, initial);
  const { guard, bind } = useSubmitLock(pending);
  const [dates, setDates] = useState<string[]>([]);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error || fa.common.saveFailed);
      return;
    }
    toast.success(fa.common.holidayCreated);
    setDates([]);
    setFormKey((key) => key + 1);
    router.refresh();
  }, [state, router]);

  return (
    <form
      key={formKey}
      ref={bind}
      action={action}
      className="space-y-4"
      onSubmit={(event) => guard(event)}
    >
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
      <Button type="submit" disabled={pending || dates.length === 0} aria-busy={pending}>
        {pending ? fa.common.loading : "افزودن تعطیلات"}
      </Button>
    </form>
  );
}
