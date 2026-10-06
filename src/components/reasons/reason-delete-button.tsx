"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/actions/auth";
import { deleteReasonAction } from "@/server/actions/reasons";

const initial: ActionResult | null = null;

export function ReasonDeleteButton({
  id,
  disabled,
}: {
  id: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteReasonAction, initial);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={disabled || pending}
          >
            حذف
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دلیل؟</AlertDialogTitle>
            <AlertDialogDescription>
              اگر این دلیل در پاسخ کارها ثبت شده باشد، حذف انجام نمی‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <AlertDialogAction type="submit">تأیید حذف</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state && !state.ok ? (
        <p className="text-destructive mt-1 text-xs">{state.error}</p>
      ) : null}
    </>
  );
}
