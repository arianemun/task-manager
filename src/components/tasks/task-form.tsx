"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AssigneePicker, type DeptOption, type StaffOption } from "@/components/tasks/assignee-picker";
import { EisenhowerMatrix } from "@/components/tasks/eisenhower-matrix";
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
import type { Priority } from "@/db/schema";
import { fa } from "@/lib/i18n/fa";
import { useSubmitLock } from "@/lib/ui/submit-lock";
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
    priority: Priority;
    requiresNote: boolean;
    requiresAttachment: boolean;
    skipHolidays: boolean;
    completionMode?: "INDIVIDUAL" | "SHARED";
    startDate: string;
    endDate: string | null;
    dueTime: string | null;
    startTime?: string | null;
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
  const { guard, bind } = useSubmitLock(pending);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState<string | null>(initial?.endDate ?? null);
  const [skipHolidays, setSkipHolidays] = useState(initial?.skipHolidays ?? true);
  const [completionMode, setCompletionMode] = useState<"INDIVIDUAL" | "SHARED">(
    initial?.completionMode ?? "INDIVIDUAL",
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ? String(initial.categoryId) : "",
  );
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "SCHEDULE");
  const [requiresNote, setRequiresNote] = useState(initial?.requiresNote ?? false);
  const [requiresAttachment, setRequiresAttachment] = useState(
    initial?.requiresAttachment ?? false,
  );
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceState>({
    recurrenceType: initial?.recurrenceType ?? "DAILY",
    config: initial?.recurrenceConfig ?? { interval: 1, excludeWeekdays: [] },
  });
  const [assignees, setAssignees] = useState({
    key: 0,
    userIds: initial?.userIds ?? [],
    departmentIds: initial?.departmentIds ?? [],
  });
  const [showCopy, setShowCopy] = useState(Boolean(copyFromTitle));
  const [previewOpen, setPreviewOpen] = useState(false);

  const resetForAnother = useCallback(() => {
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate(null);
    setSkipHolidays(true);
    setCompletionMode("INDIVIDUAL");
    setCategoryId("");
    setPriority("SCHEDULE");
    setRequiresNote(false);
    setRequiresAttachment(false);
    setDueTime("");
    setStartTime("");
    setRecurrence({
      recurrenceType: "DAILY",
      config: { interval: 1, excludeWeekdays: [] },
    });
    setAssignees((prev) => ({
      key: prev.key + 1,
      userIds: [],
      departmentIds: [],
    }));
    setShowCopy(false);
  }, []);

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error || fa.common.taskSaveFailed);
      return;
    }
    const hint =
      "recurrenceChangedHint" in state
        ? (state as { recurrenceChangedHint?: string }).recurrenceChangedHint
        : undefined;
    if (mode === "create") {
      const taskId = "taskId" in state ? (state as { taskId?: number }).taskId : undefined;
      const after =
        "after" in state && (state as { after?: string }).after === "new" ? "new" : "edit";
      toast.success(fa.common.taskCreated);
      if (hint) toast.message(hint);
      if (after === "new") {
        resetForAnother();
        router.replace("/admin/tasks/new");
        return;
      }
      if (taskId) router.replace(`/admin/tasks/${taskId}`);
      return;
    }
    if (hint) toast.message(hint);
    else toast.success(fa.common.success);
    router.refresh();
  }, [state, router, mode, resetForAnother]);

  const preview = (
    <OccurrencePreview
      recurrence={recurrence}
      startDate={startDate}
      endDate={endDate}
      skipHolidays={skipHolidays}
    />
  );

  return (
    <form
      ref={bind}
      action={formAction}
      className="space-y-6"
      onSubmit={(event) => {
        guard(event);
      }}
    >
      {mode === "edit" && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      {showCopy && copyFromTitle ? (
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
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">توضیحات</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
            />
          </div>
          <div className="space-y-2 sm:max-w-xs">
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
            <Label>{fa.auditFields.priority}</Label>
            <EisenhowerMatrix
              value={priority}
              onChange={setPriority}
              disabled={pending}
            />
            <input type="hidden" name="priority" value={priority} />
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">{fa.tasks.startTime}</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                dir="ltr"
                className="text-start"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                disabled={pending}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">{fa.tasks.startTimeHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueTime">مهلت روزانه (HH:mm)</Label>
              <Input
                id="dueTime"
                name="dueTime"
                dir="ltr"
                className="text-start"
                placeholder="مثلاً 14:00"
                value={dueTime}
                onChange={(event) => setDueTime(event.target.value)}
                disabled={pending}
              />
            </div>
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
            <fieldset className="w-full space-y-2">
              <legend className="text-sm font-medium">نحوه تکمیل</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="completionMode"
                  value="INDIVIDUAL"
                  checked={completionMode === "INDIVIDUAL"}
                  onChange={() => setCompletionMode("INDIVIDUAL")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">فردی</span>
                  <span className="text-muted-foreground block text-xs">
                    هر عضو جدا پاسخ می‌دهد و فقط درصد خودش عوض می‌شود.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="completionMode"
                  value="SHARED"
                  checked={completionMode === "SHARED"}
                  onChange={() => setCompletionMode("SHARED")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">مشترک</span>
                  <span className="text-muted-foreground block text-xs">
                    انجام یک نفر کافی است. بقیه نه امتیاز می‌گیرند و نه جریمه.
                  </span>
                </span>
              </label>
            </fieldset>
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
            key={assignees.key}
            initialUserIds={assignees.userIds}
            initialDepartmentIds={assignees.departmentIds}
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

      <div className="bg-background/95 sticky-actions sticky z-10 flex flex-wrap gap-2 border-t py-3 backdrop-blur md:static md:bottom-auto md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
        {mode === "create" ? (
          <>
            <Button
              type="submit"
              name="after"
              value="edit"
              disabled={pending}
              aria-busy={pending}
              className="min-h-11 flex-1 md:flex-none"
            >
              {pending ? fa.common.loading : fa.common.register}
            </Button>
            <Button
              type="submit"
              name="after"
              value="new"
              variant="outline"
              disabled={pending}
              aria-busy={pending}
              className="min-h-11 flex-1 md:flex-none"
            >
              {pending ? fa.common.loading : fa.common.registerAndNew}
            </Button>
          </>
        ) : (
          <Button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 flex-1 md:flex-none"
          >
            {pending ? fa.common.loading : fa.common.save}
          </Button>
        )}
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
