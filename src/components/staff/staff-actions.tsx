"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordRevealDialog } from "@/components/staff/password-reveal-dialog";
import { Button } from "@/components/ui/button";
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
import type { ActionResult } from "@/server/actions/auth";
import {
  resetStaffPasswordAction,
  setStaffActiveAction,
  softDeleteStaffAction,
} from "@/server/actions/staff";

const initial: ActionResult | null = null;

export function StaffToolbar({
  userId,
  isActive,
}: {
  userId: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [resetState, resetAction, resetPending] = useActionState(
    resetStaffPasswordAction,
    initial,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setStaffActiveAction,
    initial,
  );
  const [delState, delAction, delPending] = useActionState(
    softDeleteStaffAction,
    initial,
  );

  useEffect(() => {
    if (resetState?.ok && resetState.generatedPassword) {
      setPassword(resetState.generatedPassword);
    }
  }, [resetState]);

  useEffect(() => {
    if (activeState?.ok || delState?.ok) {
      setDeleteOpen(false);
      router.refresh();
    }
  }, [activeState, delState, router]);

  const error =
    (resetState && !resetState.ok && resetState.error) ||
    (activeState && !activeState.ok && activeState.error) ||
    (delState && !delState.ok && delState.error);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <form action={resetAction}>
          <input type="hidden" name="id" value={userId} />
          <Button type="submit" variant="outline" disabled={resetPending}>
            ریست رمز
          </Button>
        </form>
        <form action={activeAction}>
          <input type="hidden" name="id" value={userId} />
          <input
            type="hidden"
            name="isActive"
            value={isActive ? "false" : "true"}
          />
          <Button type="submit" variant="outline" disabled={activePending}>
            {isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
          </Button>
        </form>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={delPending}>
              حذف (نرم)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف نرم پرسنل؟</AlertDialogTitle>
              <AlertDialogDescription>
                حساب غیرفعال و از لیست‌ها حذف می‌شود؛ دادهٔ تاریخی حفظ می‌گردد.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>انصراف</AlertDialogCancel>
              <form action={delAction}>
                <input type="hidden" name="id" value={userId} />
                <AlertDialogAction
                  type="submit"
                  variant="destructive"
                  disabled={delPending}
                >
                  حذف
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <PasswordRevealDialog
        password={password}
        onClose={() => setPassword(null)}
        title="رمز جدید (یک‌بار نمایش)"
      />
    </div>
  );
}
