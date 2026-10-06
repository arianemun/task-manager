"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/server/actions/auth";
import {
  activateTaskAction,
  archiveTaskAction,
} from "@/server/actions/tasks";

const initial: ActionResult | null = null;

export function TaskArchiveButton({
  id,
  isActive,
}: {
  id: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const action = isActive ? archiveTaskAction : activateTaskAction;
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(isActive ? "آرشیو شد" : "فعال شد");
      router.refresh();
    } else toast.error(state.error);
  }, [state, router, isActive]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant={isActive ? "outline" : "default"}
        disabled={pending}
      >
        {isActive ? "آرشیو" : "فعال‌سازی"}
      </Button>
    </form>
  );
}
