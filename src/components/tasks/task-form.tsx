"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AssigneePicker, type DeptOption, type StaffOption } from "@/components/tasks/assignee-picker";
import { OccurrencePreview } from "@/components/tasks/occurrence-preview";
import {
  RecurrenceFields,
  type RecurrenceState,
} from "@/components/tasks/recurrence-fields";
import { JalaliDateField } from "@/components/jalali/jalali-date-field";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ChevronDown } from "lucide-react";
import { fa } from "@/lib/i18n/fa";
import type { ActionResult } from "@/server/actions/auth";
import {
  createTaskAction,
  updateTaskAction,
} from "@/server/actions/tasks";

type Category = { id: number; name: string };

type Props = {
  mode: "create" | "edit";
  categories: Category[];
  staff: StaffOption[];
  departments: DeptOption[];
  actorRole: "ADMIN" | "MANAGER";
  managerDepartmentId?: number | null;
  initial?: {
    id: number;
    title: string;
    description: string | null;
    categoryId: number | null;
    priority: "LOW" | "MEDIUM" | "HIGH";
    requiresNote: boolean;
    requiresAttachment: boolean;
    skipHolidays: boolean;
    startDate: string;
    endDate: string | null;
    dueTime: string | null;
    recurrenceType: RecurrenceState["recurrenceType"];
    recurrenceConfig: Record<string, unknown>;
    userIds: number[];
    departmentIds: number[];
    occurrenceCount?: number;
  };
  copyFromTitle?: string;
};

const emptyState: ActionResult | null = null;

export function TaskForm({
  mode,
  categories,
  staff,
  departments,
  actorRole,
  managerDepartmentId,
  initial,
  copyFromTitle,
}: Props) {
  const router = useRouter();
  const action = mode === "create" ? createTaskAction : updateTaskAction;
  const [state, formAction, pending] = useActionState(action, emptyState);

  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState<string | null>(initial?.endDate ?? null);
  const [skipHolidays, setSkipHolidays] = useState(initial?.skipHolidays ?? true);
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ? String(initial.categoryId) : "",
  );
  const [priority, setPriority] = useState(initial?.priority ?? "MEDIUM");
  const [requiresNote, setRequiresNote] = useState(initial?.requiresNote ?? false);
  const [requiresAttachment, setRequiresAttachment] = useState(
    initial?.requiresAttachment ?? false,
  );
  const [recurrence, setRecurrence] = useState<RecurrenceState>({
    recurrenceType: initial?.recurrenceType ?? "DAILY",
    config: initial?.recurrenceConfig ?? { interval: 1, excludeWeekdays: [] },
  });
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error);
      return;
    }
    const hint =
      "recurrenceChangedHint" in state
        ? (state as { recurrenceChangedHint?: string }).recurrenceChangedHint
        : undefined;
    if (hint) toast.message(hint);
    else toast.success(fa.common.success);

    const taskId =
      "taskId" in state ? (state as { taskId?: number }).taskId : initial?.id;
    if (taskId) router.push(`/admin/tasks/${taskId}`);
    else router.push("/admin/tasks");
    router.refresh();
  }, [state, router, initial?.id]);

  const preview = (
    <OccurrencePreview
      recurrence={recurrence}
      startDate={startDate}
      endDate={endDate}
      skipHolidays={skipHolidays}
    />
  );

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      {copyFromTitle ? (
        <p className="bg-muted rounded-md px-3 py-2 text-sm">
          کپی از: <strong>{copyFromTitle}</strong>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">عنوان</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={initial?.title ?? ""}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">توضیحات</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={initial?.description ?? ""}
              disabled={pending}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>دسته</Label>
              <Select
                value={categoryId || "__none__"}
                onValueChange={(v) =>
                  setCategoryId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger aria-label="دسته">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="categoryId" value={categoryId} />
            </div>
            <div className="space-y-2">
              <Label>اولویت</Label>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setPriority(v as "LOW" | "MEDIUM" | "HIGH")
                }
              >
                <SelectTrigger aria-label="اولویت">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fa.priority).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="priority" value={priority} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <JalaliDateField
              name="startDate"
              label="تاریخ شروع"
              value={startDate || null}
              required
              onChange={(g) => setStartDate(g ?? "")}
            />
            <JalaliDateField
              name="endDate"
              label="تاریخ پایان (اختیاری)"
              value={endDate}
              onChange={(g) => setEndDate(g)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueTime">مهلت روزانه (HH:mm)</Label>
            <Input
              id="dueTime"
              name="dueTime"
              dir="ltr"
              className="text-start"
              placeholder="مثلاً 14:00"
              defaultValue={initial?.dueTime ?? ""}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={skipHolidays}
                onCheckedChange={setSkipHolidays}
                aria-label="رد کردن تعطیلات"
              />
              رد کردن تعطیلات
            </label>
            <input
              type="hidden"
              name="skipHolidays"
              value={skipHolidays ? "true" : "false"}
            />
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={requiresNote}
                onCheckedChange={setRequiresNote}
                aria-label="نیاز به توضیح"
              />
              نیاز به توضیح
            </label>
            {requiresNote ? (
              <input type="hidden" name="requiresNote" value="true" />
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={requiresAttachment}
                onCheckedChange={setRequiresAttachment}
                aria-label="نیاز به پیوست"
              />
              نیاز به پیوست
            </label>
            {requiresAttachment ? (
              <input type="hidden" name="requiresAttachment" value="true" />
            ) : null}
          </div>

          <RecurrenceFields value={recurrence} onChange={setRecurrence} />

          <AssigneePicker
            staff={staff}
            departments={departments}
            initialUserIds={initial?.userIds}
            initialDepartmentIds={initial?.departmentIds}
            managerLockedDeptId={
              actorRole === "MANAGER" ? managerDepartmentId ?? null : null
            }
          />
        </div>

        {/* دسکتاپ: پیش‌نمایش چسبان */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">{preview}</div>
        </aside>
      </div>

      {/* موبایل: پیش‌نمایش جمع‌شو */}
      <Collapsible
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        className="lg:hidden"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="group w-full justify-between"
            aria-label="پیش‌نمایش وقوع‌ها"
          >
            پیش‌نمایش وقوع‌ها
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">{preview}</CollapsibleContent>
      </Collapsible>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="bg-background/95 sticky bottom-0 z-10 flex flex-wrap gap-2 border-t py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
        <Button
          type="submit"
          disabled={pending}
          className="min-h-11 flex-1 md:flex-none"
        >
          {pending ? fa.common.loading : fa.common.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          asChild
          className="min-h-11"
        >
          <Link href="/admin/tasks">{fa.common.cancel}</Link>
        </Button>
      </div>
    </form>
  );
}
