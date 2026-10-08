"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { MediaFailureView } from "@/lib/permissions/media-feedback";

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
  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled}
      aria-busy={disabled || undefined}
      onClick={onActivate}
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
