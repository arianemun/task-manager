"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { JalaliDateRangePicker } from "@/components/jalali/jalali-date-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/server/actions/auth";
import { createStaffLeaveAction } from "@/server/actions/board";

const initial: ActionResult | null = null;

type Staff = { id: number; fullName: string };

export function LeaveForm({ staff }: { staff: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createStaffLeaveAction,
    initial,
  );
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("معافیت گروهی ثبت شد");
      setOpen(false);
      setUserId("");
      setFrom(null);
      setTo(null);
    } else toast.error(state.error);
  }, [state]);

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button type="button" variant="outline">
          ثبت معافیت گروهی
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>معافیت گروهی (مرخصی)</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <ResponsiveDialogBody className="space-y-3">
            <div className="space-y-2">
              <Label>پرسنل</Label>
              <Select value={userId} onValueChange={setUserId} required>
                <SelectTrigger aria-label="پرسنل">
                  <SelectValue placeholder="انتخاب…" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="userId" value={userId} />
            </div>
            <JalaliDateRangePicker
              label="بازه مرخصی"
              from={from}
              to={to}
              onChange={(r) => {
                setFrom(r.from);
                setTo(r.to);
              }}
            />
            <input type="hidden" name="startDate" value={from ?? ""} />
            <input type="hidden" name="endDate" value={to ?? ""} />
            <div className="space-y-2">
              <Label htmlFor="leave-reason">دلیل</Label>
              <Textarea id="leave-reason" name="reason" required rows={2} />
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              type="submit"
              disabled={pending || !userId || !from || !to}
              className="w-full"
            >
              ثبت معافیت
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
