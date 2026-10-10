"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fa } from "@/lib/i18n/fa";
import { formatRemainingNatural } from "@/lib/me/remaining";
import { cn } from "@/lib/utils";
import { resizeImageFile } from "@/lib/client/resize-image";
import { submitOccurrenceAction } from "@/server/actions/occurrences";
import type { MeOccurrence } from "@/server/queries/me-today";
import type { NotDoneReason } from "@/lib/settings/not-done-reasons";
import { ResponseSheet } from "@/components/me/response-sheet";

type Props = {
  occ: MeOccurrence;
  reasons: NotDoneReason[];
  highlighted?: boolean;
};

type LocalState = {
  status: MeOccurrence["status"];
  note: string | null;
  reasonCode: string | null;
  attachmentPath: string | null;
  editedAt: Date | null;
  completedAt: Date | null;
};

function statusBadgeVariant(
  status: MeOccurrence["status"],
): "success" | "warning" | "danger" | "muted" | "info" | "outline" {
  switch (status) {
    case "DONE":
      return "success";
    case "DONE_LATE":
      return "warning";
    case "NOT_DONE":
      return "danger";
    case "MISSED":
      return "danger";
    case "EXCUSED":
      return "info";
    default:
      return "muted";
  }
}

export function TaskCard({ occ, reasons, highlighted = false }: Props) {
  const router = useRouter();
  const [local, setLocal] = useState<LocalState>({
    status: occ.status,
    note: occ.note,
    reasonCode: occ.reasonCode,
    attachmentPath: occ.attachmentPath,
    editedAt: occ.editedAt,
    completedAt: occ.completedAt,
  });
  const [sheet, setSheet] = useState<"done" | "not_done" | null>(null);
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  const closedByOther = occ.fulfilledByOther;
  const locked =
    occ.locked ||
    local.status === "MISSED" ||
    local.status === "EXCUSED" ||
    closedByOther;
  const responded = local.status !== "PENDING";

  async function submit(
    intent: "done" | "not_done",
    extra: {
      note?: string;
      reasonCode?: string;
      file?: File | null;
    },
  ) {
    const prev = { ...local };
    const optimisticStatus =
      intent === "done" ? ("DONE" as const) : ("NOT_DONE" as const);
    setLocal({
      status: optimisticStatus,
      note: extra.note ?? local.note,
      reasonCode: extra.reasonCode ?? null,
      attachmentPath: local.attachmentPath,
      editedAt: responded ? new Date() : null,
      completedAt: new Date(),
    });
    setSheet(null);
    setJustSaved(true);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("occurrenceId", String(occ.id));
      fd.set("intent", intent);
      if (extra.note) fd.set("note", extra.note);
      if (extra.reasonCode) fd.set("reasonCode", extra.reasonCode);
      if (extra.file) {
        const resized = await resizeImageFile(extra.file);
        fd.set("attachment", resized);
      }
      const res = await submitOccurrenceAction(fd);
      if (!res.ok) {
        setLocal(prev);
        setJustSaved(false);
        toast.error(res.error);
        return;
      }
      if (res.occurrence) {
        setLocal({
          status: res.occurrence.status as MeOccurrence["status"],
          note: res.occurrence.note,
          reasonCode: res.occurrence.reasonCode,
          attachmentPath: res.occurrence.attachmentPath,
          editedAt: res.occurrence.editedAt
            ? new Date(res.occurrence.editedAt)
            : null,
          completedAt: res.occurrence.completedAt
            ? new Date(res.occurrence.completedAt)
            : null,
        });
      }
      toast.success("ثبت شد");
      router.refresh();
    });
  }

  function onClick(intent: "done" | "not_done") {
    const needsSheet =
      intent === "not_done" ||
      occ.requiresNote ||
      occ.requiresAttachment ||
      responded;
    if (needsSheet) {
      setSheet(intent);
      return;
    }
    void submit(intent, {});
  }

  const remaining = formatRemainingNatural({
    dueAt: occ.dueAt,
    periodEnd: occ.periodEnd,
    daysLeft: occ.daysLeft,
    group: occ.group,
  });

  return (
    <article
      id={`occ-${occ.id}`}
      className={cn(
        "scroll-mt-24 space-y-3 rounded-xl border p-4 transition-all duration-300",
        highlighted && "ring-primary ring-2",
        responded && "bg-muted/20",
        justSaved && responded && "scale-[0.99] opacity-90",
        locked && "opacity-80",
        closedByOther && "text-muted-foreground",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start gap-2">
            {locked ? (
              <Lock
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                aria-label="قفل"
              />
            ) : null}
            <h3 className="text-base font-semibold leading-snug">{occ.title}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            {occ.categoryName ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: occ.categoryColor ?? "#64748b" }}
                  aria-hidden
                />
                {occ.categoryName}
              </span>
            ) : null}
            {occ.priority === "DO" ? (
              <Badge variant="danger" className="font-semibold">
                {fa.priority.DO}
              </Badge>
            ) : null}
            {occ.priority === "DELEGATE" ? (
              <Badge variant="warning" className="font-semibold">
                {fa.priority.DELEGATE}
              </Badge>
            ) : null}
            {!responded ? (
              <span className="text-muted-foreground text-xs">
                {remaining}
              </span>
            ) : null}
            {responded ? (
              <Badge variant={statusBadgeVariant(local.status)}>
                {fa.status[local.status]}
              </Badge>
            ) : null}
            {local.editedAt ? (
              <Badge variant="warning">ویرایش‌شده</Badge>
            ) : null}
          </div>
        </div>
      </div>

      {local.note ? (
        <p className="text-muted-foreground text-sm">توضیح: {local.note}</p>
      ) : null}
      {local.attachmentPath ? (
        <a
          className="text-primary text-sm underline"
          href={`/api/files/${local.attachmentPath}`}
          target="_blank"
          rel="noreferrer"
        >
          مشاهده پیوست
        </a>
      ) : null}

      {closedByOther ? (
        <p className="text-muted-foreground text-sm">
          انجام‌شده توسط {occ.completedByName ?? "همکار"}
        </p>
      ) : locked ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Lock className="size-3.5" />
          قفل — فقط خواندنی
          {occ.daysLeft === 0 && occ.locked
            ? null
            : ` · دوره تمام‌شده`}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            className="min-h-11 w-full text-base"
            disabled={pending}
            onClick={() => onClick("done")}
          >
            {pending && sheet !== "not_done" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            انجام شد
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 w-full text-base"
            disabled={pending}
            onClick={() => onClick("not_done")}
          >
            {pending && sheet === "not_done" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            انجام نشد
          </Button>
        </div>
      )}

      {occ.completionMode === "SHARED" && !closedByOther && !locked && !responded ? (
        <p className="text-muted-foreground text-xs">
          کار مشترک است. با انجام شما، برای بقیه اعضا بدون اثر روی درصدشان بسته می‌شود.
        </p>
      ) : null}
      {occ.completionMode === "SHARED" && !closedByOther && responded && (local.status === "DONE" || local.status === "DONE_LATE") ? (
        <p className="text-muted-foreground text-xs">
          شما این کار مشترک را ثبت کردید.
        </p>
      ) : null}

      <ResponseSheet
        open={sheet != null}
        intent={sheet ?? "done"}
        reasons={reasons}
        requiresNote={occ.requiresNote || sheet === "not_done"}
        requiresAttachment={occ.requiresAttachment}
        initialNote={local.note ?? ""}
        initialReason={local.reasonCode ?? ""}
        pending={pending}
        onOpenChange={(o) => {
          if (!o) setSheet(null);
        }}
        onSubmit={(payload) => {
          if (sheet) void submit(sheet, payload);
        }}
      />
    </article>
  );
}
