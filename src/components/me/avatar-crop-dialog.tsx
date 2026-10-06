"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AVATAR_CROP_VIEW,
  AVATAR_OUTPUT_SIZE,
  avatarCropLayout,
  avatarCropSourceRect,
} from "@/lib/client/avatar-crop";
import { toFaDigits } from "@/lib/utils";

type Props = {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
};

export function AvatarCropDialog({
  file,
  open,
  onOpenChange,
  onConfirm,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{
    px: number;
    py: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!file || !open) return;
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNatural({ w: 0, h: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  const ready = natural.w > 0 && natural.h > 0;
  const layout = ready
    ? avatarCropLayout(natural.w, natural.h, zoom, pan.x, pan.y)
    : null;

  async function confirm() {
    const img = imgRef.current;
    if (!img || !ready || !file) return;
    setBusy(true);
    try {
      const rect = avatarCropSourceRect(natural.w, natural.h, zoom, pan.x, pan.y);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT_SIZE;
      canvas.height = AVATAR_OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        img,
        rect.x,
        rect.y,
        rect.size,
        rect.size,
        0,
        0,
        AVATAR_OUTPUT_SIZE,
        AVATAR_OUTPUT_SIZE,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) return;
      const base = file.name.replace(/\.[^.]+$/, "") || "avatar";
      onConfirm(
        new File([blob], `${base}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        }),
      );
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>برش آواتار</DialogTitle>
          <DialogDescription>
            تصویر را جابه‌جا کنید و بزرگ‌نمایی را تنظیم کنید. دایره، همان نمای
            پروفایل است.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative size-[280px] touch-none overflow-hidden rounded-full bg-muted ring-2 ring-primary/70"
            onPointerDown={(e) => {
              if (!layout) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                px: e.clientX,
                py: e.clientY,
                x: layout.panX,
                y: layout.panY,
              };
            }}
            onPointerMove={(e) => {
              if (!drag.current || !ready) return;
              const next = avatarCropLayout(
                natural.w,
                natural.h,
                zoom,
                drag.current.x + (e.clientX - drag.current.px),
                drag.current.y + (e.clientY - drag.current.py),
              );
              setPan({ x: next.panX, y: next.panY });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={src}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                className="absolute top-1/2 left-1/2 max-w-none select-none"
                style={
                  layout
                    ? {
                        width: layout.displayW,
                        height: layout.displayH,
                        transform: `translate(calc(-50% + ${layout.panX}px), calc(-50% + ${layout.panY}px))`,
                      }
                    : { width: AVATAR_CROP_VIEW, height: AVATAR_CROP_VIEW, transform: "translate(-50%, -50%)" }
                }
              />
            ) : null}
          </div>

          <label className="flex w-full max-w-[280px] flex-col gap-2 text-sm">
            <span className="text-muted-foreground flex items-center justify-between">
              <span>بزرگ‌نمایی</span>
              <span>{toFaDigits(Math.round(zoom * 100))}٪</span>
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              aria-label="بزرگ‌نمایی"
              className="accent-primary h-11 w-full cursor-pointer"
              onChange={(e) => {
                const nextZoom = Number(e.target.value);
                setZoom(nextZoom);
                if (!ready) return;
                const next = avatarCropLayout(
                  natural.w,
                  natural.h,
                  nextZoom,
                  pan.x,
                  pan.y,
                );
                setPan({ x: next.panX, y: next.panY });
              }}
            />
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            انصراف
          </Button>
          <Button type="button" onClick={confirm} disabled={!ready || busy}>
            تأیید برش
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
