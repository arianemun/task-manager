"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
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
import { fa } from "@/lib/i18n/fa";

const FORM_ID = "drawer-change-password";

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-4" />
        تغییر رمز عبور
      </Button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>تغییر رمز عبور</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              رمز فعلی و رمز جدید را وارد کنید
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <ChangePasswordForm
              id={FORM_ID}
              hideSubmit
              onPendingChange={setPending}
            />
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              type="submit"
              form={FORM_ID}
              className="w-full"
              disabled={pending}
            >
              {pending ? fa.common.loading : fa.auth.changePassword}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
