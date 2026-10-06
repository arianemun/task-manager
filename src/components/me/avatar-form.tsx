"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { AvatarCropDialog } from "@/components/me/avatar-crop-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/server/actions/auth";
import { uploadStaffAvatarAction } from "@/server/actions/staff";

const initial: ActionResult | null = null;

type Props = {
  fullName: string;
  avatarPath?: string | null;
};

export function AvatarForm({ fullName, avatarPath }: Props) {
  const [state, formAction, pending] = useActionState(
    uploadStaffAvatarAction,
    initial,
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("آواتار به‌روز شد");
      setFile(null);
      setPreview(null);
    } else toast.error(state.error);
  }, [state]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const initials = fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");

  const src =
    preview ??
    (avatarPath ? `/api/files/${avatarPath}` : undefined);

  return (
    <form
      action={(fd) => {
        if (file) fd.set("avatar", file);
        formAction(fd);
      }}
      className="flex flex-col items-center gap-5"
    >
      <Avatar className="size-44 sm:size-52">
        {src ? <AvatarImage src={src} alt={fullName} /> : null}
        <AvatarFallback className="text-3xl sm:text-4xl">
          {initials || "?"}
        </AvatarFallback>
      </Avatar>

      <Label
        htmlFor="avatar-file"
        className="border-input bg-background hover:bg-accent inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs"
      >
        <Camera className="size-4" />
        انتخاب تصویر
      </Label>
      <input
        id="avatar-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!picked) return;
          if (!picked.type.startsWith("image/")) {
            toast.error("فقط تصویر jpg، png یا webp مجاز است");
            return;
          }
          setCropFile(picked);
          setCropOpen(true);
        }}
      />

      <AvatarCropDialog
        file={cropFile}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onConfirm={setFile}
      />

      {file ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-muted-foreground text-xs">برش آمادهٔ ذخیره است</p>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            ذخیره آواتار
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-center text-xs">
          تصویر را انتخاب کنید، برش دهید و سپس ذخیره کنید
        </p>
      )}
    </form>
  );
}
