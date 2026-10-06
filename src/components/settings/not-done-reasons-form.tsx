"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NotDoneReason } from "@/lib/settings/not-done-reasons";
import type { ActionResult } from "@/server/actions/auth";
import { saveNotDoneReasonsAction } from "@/server/actions/settings";

const initial: ActionResult | null = null;

export function NotDoneReasonsForm({
  initialReasons,
}: {
  initialReasons: NotDoneReason[];
}) {
  const [rows, setRows] = useState(initialReasons);
  const [state, formAction, pending] = useActionState(
    saveNotDoneReasonsAction,
    initial,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("ذخیره شد");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="reasonsJson" value={JSON.stringify(rows)} />
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>کد</Label>
              <Input
                dir="ltr"
                className="text-start"
                value={r.code}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...r, code: e.target.value };
                  setRows(next);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>برچسب</Label>
              <div className="flex gap-2">
                <Input
                  value={r.label}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...r, label: e.target.value };
                    setRows(next);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  حذف
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setRows([...rows, { code: `reason_${rows.length + 1}`, label: "" }])
          }
        >
          افزودن دلیل
        </Button>
        <Button type="submit" disabled={pending}>
          ذخیره
        </Button>
      </div>
    </form>
  );
}
