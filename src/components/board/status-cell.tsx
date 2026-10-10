"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  STATUS_COLORS,
  STATUS_DOT,
  STATUS_ICONS,
} from "@/components/board/status-colors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import type { OccurrenceStatus } from "@/db/schema";
import { useIsDesktop } from "@/hooks/use-media-query";
import { fa } from "@/lib/i18n/fa";
import { occurrenceStatusLabel } from "@/lib/reports/status-label";
import { cn, toFaDigits } from "@/lib/utils";
import type { ActionResult } from "@/server/actions/auth";
import { updateOccurrenceStatusAction } from "@/server/actions/board";

type Props = {
  occurrenceId: number;
  status: OccurrenceStatus;
  completedAt: Date | null;
  note: string | null;
  canEdit: boolean;
  taskTitle?: string;
  staffName?: string;
  closedByName?: string | null;
  notStarted?: boolean;
};

const initial: ActionResult | null = null;

function StatusChip({
  status,
  label,
  className,
}: {
  status: OccurrenceStatus;
  label?: string;
  className?: string;
}) {
  const color = STATUS_COLORS[status];
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex min-w-14 items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium",
        color.bg,
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
        aria-hidden
      />
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only md:not-sr-only md:inline">{label ?? color.label}</span>
    </span>
  );
}

function StatusEditForm({
  occurrenceId,
  status,
  pending,
  formAction,
}: {
  occurrenceId: number;
  status: OccurrenceStatus;
  pending: boolean;
  formAction: (payload: FormData) => void;
}) {
  const [next, setNext] = useState(status);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="occurrenceId" value={occurrenceId} />
      <div className="space-y-2">
        <Label>وضعیت جدید</Label>
        <Select value={next} onValueChange={(v) => setNext(v as OccurrenceStatus)}>
          <SelectTrigger aria-label="وضعیت جدید">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(fa.status).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="status" value={next} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`reason-${occurrenceId}`}>دلیل (الزامی)</Label>
        <Textarea
          id={`reason-${occurrenceId}`}
          name="reason"
          required
          rows={3}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        ذخیره
      </Button>
    </form>
  );
}

export function StatusCell({
  occurrenceId,
  status,
  completedAt,
  note,
  canEdit,
  taskTitle,
  staffName,
  closedByName,
  notStarted = false,
}: Props) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateOccurrenceStatusAction,
    initial,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("وضعیت به‌روز شد");
      setOpen(false);
    } else toast.error(state.error);
  }, [state]);

  const label = occurrenceStatusLabel(status, notStarted);
  const tip = [
    label,
    closedByName ? `ثبت توسط ${closedByName}` : null,
    completedAt
      ? `ثبت: ${toFaDigits(new Date(completedAt).toLocaleString("fa-IR"))}`
      : null,
    note ? `توضیح: ${note}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  const aria = [
    staffName,
    taskTitle,
    label,
  ]
    .filter(Boolean)
    .join("، ");

  const details = (
    <div className="space-y-2 text-sm">
      <p className="font-medium">{label}</p>
      {completedAt ? (
        <p className="text-muted-foreground text-xs">
          ثبت: {toFaDigits(new Date(completedAt).toLocaleString("fa-IR"))}
        </p>
      ) : null}
      {note ? (
        <p className="text-muted-foreground text-xs whitespace-pre-wrap">
          توضیح: {note}
        </p>
      ) : null}
      {closedByName ? (
        <p className="text-muted-foreground text-xs">ثبت توسط {closedByName}</p>
      ) : null}
    </div>
  );

  const chip = (
    <span className="inline-flex flex-col items-center gap-0.5">
      <StatusChip status={status} label={label} />
      {closedByName ? (
        <span className="text-muted-foreground max-w-24 truncate text-[10px] leading-tight">
          {closedByName}
        </span>
      ) : null}
    </span>
  );

  if (!canEdit) {
    return (
      <span title={tip} aria-label={aria}>
        {chip}
      </span>
    );
  }

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="cursor-pointer rounded focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`ویرایش وضعیت: ${aria}`}
            title={tip}
          >
            {chip}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-72 space-y-3">
          {details}
          <StatusEditForm
            occurrenceId={occurrenceId}
            status={status}
            pending={pending}
            formAction={formAction}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`ویرایش وضعیت: ${aria}`}
          title={tip}
        >
          {chip}
        </button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>تغییر وضعیت</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-3">
          {details}
          <StatusEditForm
            occurrenceId={occurrenceId}
            status={status}
            pending={pending}
            formAction={formAction}
          />
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
