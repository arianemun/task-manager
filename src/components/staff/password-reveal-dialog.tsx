"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

type Props = {
  password: string | null;
  onClose: () => void;
  title?: string;
};

export function PasswordRevealDialog({
  password,
  onClose,
  title = "رمز موقت",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
  }

  return (
    <ResponsiveDialog
      open={Boolean(password)}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            این رمز فقط یک‌بار نمایش داده می‌شود. آن را کپی کرده و به پرسنل بدهید.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <div
            dir="ltr"
            className="bg-muted rounded-md px-3 py-3 text-center font-mono text-lg tracking-wide"
          >
            {password}
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "کپی شد" : "کپی رمز"}
          </Button>
          <Button type="button" onClick={onClose}>
            بستن
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
