"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { resizeImageFile } from "@/lib/client/resize-image";
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
      action={async (fd) => {
        if (file) {
          fd.set("avatar", await resizeImageFile(file));
        }
        formAction(fd);
      }}
      className="flex flex-col items-center gap-4"
    >
      <div className="relative">
        <Avatar className="size-28 text-2xl" size="lg">
          {src ? <AvatarImage src={src} alt={fullName} /> : null}
          <AvatarFallback>{initials || "?"}</AvatarFallback>
        </Avatar>
        <Label
          htmlFor="avatar-file"
          className="bg-primary text-primary-foreground absolute end-0 bottom-0 flex size-9 cursor-pointer items-center justify-center rounded-full shadow"
        >
          <Camera className="size-4" />
          <span className="sr-only">تغییر عکس</span>
        </Label>
        <input
          id="avatar-file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {file ? (
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          ذخیره آواتار
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">
          برای تغییر، روی آیکن دوربین بزنید
        </p>
      )}
    </form>
  );
}
