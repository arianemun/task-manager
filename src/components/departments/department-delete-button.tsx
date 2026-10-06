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
import { deleteDepartmentAction } from "@/server/actions/departments";

const initial: ActionResult | null = null;

export function DepartmentDeleteButton({
  id,
  disabled,
}: {
  id: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteDepartmentAction, initial);

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
            <AlertDialogTitle>حذف دپارتمان؟</AlertDialogTitle>
            <AlertDialogDescription>
              در صورت وجود پرسنل یا وابستگی، حذف انجام نمی‌شود.
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
