"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { NotDoneReason } from "@/lib/settings/not-done-reasons";

type Props = {
  open: boolean;
  intent: "done" | "not_done";
  reasons: NotDoneReason[];
  requiresNote: boolean;
  requiresAttachment: boolean;
  initialNote: string;
  initialReason: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    note?: string;
    reasonCode?: string;
    file?: File | null;
  }) => void;
};

export function ResponseSheet({
  open,
  intent,
  reasons,
  requiresNote,
  requiresAttachment,
  initialNote,
  initialReason,
  pending,
  onOpenChange,
  onSubmit,
}: Props) {
  const [note, setNote] = useState(initialNote);
  const [reasonCode, setReasonCode] = useState(
    initialReason || reasons[0]?.code || "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote(initialNote);
    setReasonCode(initialReason || reasons[0]?.code || "");
    setFile(null);
  }, [open, initialNote, initialReason, reasons]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const title = intent === "done" ? "ثبت انجام" : "ثبت انجام‌نشدن";
  const noteRequired = requiresNote || intent === "not_done";
  const canSubmit = useMemo(() => {
    if (pending) return false;
    if (noteRequired && !note.trim() && intent === "done") return false;
    if (intent === "not_done" && !reasonCode && !note.trim()) return false;
    if (requiresAttachment && !file) return false;
    return true;
  }, [pending, noteRequired, note, intent, reasonCode, requiresAttachment, file]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            جزئیات را تکمیل کنید و تأیید بزنید
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          {intent === "not_done" ? (
            <div className="space-y-2">
              <Label>دلیل</Label>
              <ToggleGroup
                type="single"
                value={reasonCode}
                onValueChange={(v) => {
                  if (v) setReasonCode(v);
                }}
                variant="outline"
                className="flex w-full flex-wrap justify-start gap-2"
              >
                {reasons.map((r) => (
                  <ToggleGroupItem
                    key={r.code}
                    value={r.code}
                    className="min-h-11 rounded-full px-3 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {r.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ) : null}

          {noteRequired || intent === "done" ? (
            <div className="space-y-2">
              <Label>
                توضیح{noteRequired ? " (الزامی)" : " (اختیاری)"}
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                required={noteRequired}
              />
            </div>
          ) : null}

          {requiresAttachment || intent === "done" ? (
            <div className="space-y-2">
              <Label>
                پیوست
                {requiresAttachment
                  ? " (الزامی — jpg/png/webp/pdf ≤۵MB)"
                  : " (اختیاری)"}
              </Label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="block w-full text-base md:text-sm"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="bg-muted/40 flex items-center gap-3 rounded-lg border p-2">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt=""
                      className="size-14 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-background text-muted-foreground flex size-14 items-center justify-center rounded-md border text-xs">
                      PDF
                    </div>
                  )}
                  <div className="min-w-0 flex-1 truncate text-sm">
                    {file.name}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="حذف پیوست"
                    onClick={() => setFile(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            انصراف
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!canSubmit}
            onClick={() => {
              if (intent === "done" && requiresNote && !note.trim()) return;
              if (intent === "not_done" && !reasonCode && !note.trim()) return;
              if (requiresAttachment && !file) return;
              onSubmit({
                note: note.trim() || undefined,
                reasonCode: intent === "not_done" ? reasonCode : undefined,
                file,
              });
            }}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                در حال ثبت…
              </>
            ) : (
              "تأیید"
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
