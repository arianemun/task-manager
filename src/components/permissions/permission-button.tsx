"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { MediaFailureView } from "@/lib/permissions/media-feedback";

/**
 * vaul's onPress calls setPointerCapture on the pointerdown target
 * (node_modules/vaul/dist/index.mjs, setPointerCapture). Android Chrome then
 * drops the click. pointerup still arrives, and stopping the pointerdown
 * keeps the drawer from taking the pointer.
 */
export function PermissionButton({
  children,
  disabled,
  variant = "default",
  onActivate,
}: {
  children: ReactNode;
  disabled?: boolean;
  variant?: "default" | "outline";
  onActivate: () => void;
}) {
  const last = useRef(0);
  const armed = useRef(false);

  function activate() {
    if (disabled) return;
    const now = performance.now();
    if (now - last.current < 700) return;
    last.current = now;
    onActivate();
  }

  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled}
      aria-busy={disabled || undefined}
      data-vaul-no-drag=""
      onPointerDown={(event) => {
        event.stopPropagation();
        armed.current = true;
      }}
      onPointerUp={(event) => {
        if (!armed.current) return;
        armed.current = false;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        activate();
      }}
      onPointerCancel={() => {
        armed.current = false;
      }}
      onClick={(event) => {
        event.preventDefault();
        activate();
      }}
    >
      {children}
    </Button>
  );
}

export function MediaFailureText({ view }: { view: MediaFailureView | null }) {
  if (!view) return null;
  return (
    <div className="space-y-1 text-sm leading-[1.7]">
      {view.lines.map((line, index) => (
        <p key={`${index}-${line}`}>{line}</p>
      ))}
      {view.errorName ? <p className="text-muted-foreground text-xs">{view.errorName}</p> : null}
    </div>
  );
}
