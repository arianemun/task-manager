"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/server/actions/auth";
import { fa } from "@/lib/i18n/fa";
import { useSubmitLock } from "@/lib/ui/submit-lock";
import { createAnnouncementAction } from "@/server/actions/announcements";

const initial: ActionResult | null = null;

type Dept = { id: number; name: string };

export function AnnouncementForm({
  departments,
  isManager,
}: {
  departments: Dept[];
  isManager: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createAnnouncementAction,
    initial,
  );
  const { guard, bind } = useSubmitLock(pending);
  const [formKey, setFormKey] = useState(0);
  const [audience, setAudience] = useState("ALL");
  const [departmentId, setDepartmentId] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error || fa.common.saveFailed);
      return;
    }
    toast.success(fa.common.announcementPublished);
    setAudience("ALL");
    setDepartmentId("");
    setIsPinned(false);
    setFormKey((key) => key + 1);
    router.refresh();
  }, [state, router]);

  return (
    <form
      key={formKey}
      ref={bind}
      action={action}
      className="space-y-3"
      onSubmit={(event) => guard(event)}
    >
      <div className="space-y-2">
        <Label htmlFor="title">عنوان</Label>
        <Input id="title" name="title" required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">متن</Label>
        <Textarea id="body" name="body" required rows={5} disabled={pending} />
      </div>
      {!isManager ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>مخاطب</Label>
            <Select
              value={audience}
              onValueChange={setAudience}
              disabled={pending}
            >
              <SelectTrigger aria-label="مخاطب">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">همه</SelectItem>
                <SelectItem value="DEPARTMENT">دپارتمان</SelectItem>
                <SelectItem value="USERS">کاربران مشخص</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="audience" value={audience} />
          </div>
          <div className="space-y-2">
            <Label>دپارتمان</Label>
            <Select
              value={departmentId || "__none__"}
              onValueChange={(v) =>
                setDepartmentId(v === "__none__" ? "" : v)
              }
              disabled={pending}
            >
              <SelectTrigger aria-label="دپارتمان">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="departmentId" value={departmentId} />
          </div>
        </div>
      ) : (
        <input type="hidden" name="audience" value="DEPARTMENT" />
      )}
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={isPinned}
          onCheckedChange={setIsPinned}
          disabled={pending}
          aria-label="سنجاق‌شده"
        />
        سنجاق‌شده (بالای لیست پرسنل)
      </label>
      {isPinned ? <input type="hidden" name="isPinned" value="true" /> : null}
      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? fa.common.loading : "انتشار اطلاعیه"}
      </Button>
    </form>
  );
}
