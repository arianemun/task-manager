"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RecurrenceFields,
  type RecurrenceState,
} from "@/components/tasks/recurrence-fields";
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
import { Textarea } from "@/components/ui/textarea";
import { fa } from "@/lib/i18n/fa";
import { prepareBulkTitles } from "@/lib/tasks/bulk-titles";
import { useSubmitLock } from "@/lib/ui/submit-lock";
import { toFaDigits } from "@/lib/utils";
import type { ActionResult } from "@/server/actions/auth";
import { bulkCreateTasksAction } from "@/server/actions/tasks";

type Category = { id: number; name: string };
type Person = { id: number; fullName: string };
type Department = { id: number; name: string };

type Props = {
  categories: Category[];
  staff: Person[];
  departments: Department[];
  activeTitles: string[];
  startDate: string;
};

const emptyState: ActionResult | null = null;

export function BulkTaskForm({
  categories,
  staff,
  departments,
  activeTitles,
  startDate,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    bulkCreateTasksAction,
    emptyState,
  );
  const { guard, release, bind } = useSubmitLock(pending);
  const [titles, setTitles] = useState("");
  const [assigneeKind, setAssigneeKind] = useState<"staff" | "department">(
    "department",
  );
  const [assigneeId, setAssigneeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [completionMode, setCompletionMode] = useState<"INDIVIDUAL" | "SHARED">(
    "INDIVIDUAL",
  );
  const [recurrence, setRecurrence] = useState<RecurrenceState>({
    recurrenceType: "DAILY",
    config: { interval: 1, excludeWeekdays: [] },
  });

  const prepared = useMemo(
    () => prepareBulkTitles(titles, activeTitles),
    [titles, activeTitles],
  );

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error || fa.common.taskSaveFailed);
      return;
    }
    const ids =
      "taskIds" in state && Array.isArray(state.taskIds)
        ? state.taskIds.filter((id): id is number => typeof id === "number")
        : undefined;
    const count = ids?.length ?? prepared.length;
    toast.success(`${toFaDigits(count)} ${fa.common.taskCreated}`);
    if (ids && ids.length > 0) {
      router.replace(`/admin/tasks?ids=${ids.join(",")}`);
    }
  }, [state, router, prepared.length]);

  const userIds = assigneeKind === "staff" && assigneeId ? [Number(assigneeId)] : [];
  const departmentIds =
    assigneeKind === "department" && assigneeId ? [Number(assigneeId)] : [];

  return (
    <form
      ref={bind}
      action={formAction}
      className="space-y-6"
      onSubmit={(event) => {
        if (guard(event)) return;
        if (prepared.length === 0 || !assigneeId) {
          event.preventDefault();
          release();
          toast.error(
            prepared.length === 0
              ? "حداقل یک عنوان لازم است"
              : "یک گیرنده انتخاب کنید",
          );
        }
      }}
    >
      <input type="hidden" name="title" value={prepared[0]?.title ?? " "} />
      <input type="hidden" name="startDate" value={startDate} />
      <input type="hidden" name="skipHolidays" value="true" />
      <input type="hidden" name="requiresNote" value="false" />
      <input type="hidden" name="requiresAttachment" value="false" />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="priority" value={priority} />
      <input type="hidden" name="userIds" value={JSON.stringify(userIds)} />
      <input
        type="hidden"
        name="departmentIds"
        value={JSON.stringify(departmentIds)}
      />

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="titles">عنوان‌ها</Label>
        <Textarea
          id="titles"
          name="titles"
          rows={8}
          value={titles}
          onChange={(event) => setTitles(event.target.value)}
          disabled={pending}
          placeholder={fa.common.bulkTasksHint}
        />
        <p className="text-muted-foreground text-sm">{fa.common.bulkTasksHint}</p>
      </div>

      <div className="bg-muted/40 space-y-2 rounded-md p-3 text-sm">
        <p>
          {fa.common.bulkPreviewCount}: {toFaDigits(prepared.length)}
        </p>
        {prepared.length > 0 ? (
          <ul className="space-y-1">
            {prepared.map((row) => (
              <li key={row.normalized}>
                {row.title}
                {row.duplicateOfActive ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" "}
                    — {fa.common.bulkDuplicateTitle}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <RecurrenceFields value={recurrence} onChange={setRecurrence} />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">گیرنده</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="assigneeKind"
              checked={assigneeKind === "staff"}
              onChange={() => {
                setAssigneeKind("staff");
                setAssigneeId("");
              }}
            />
            پرسنل
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="assigneeKind"
              checked={assigneeKind === "department"}
              onChange={() => {
                setAssigneeKind("department");
                setAssigneeId("");
              }}
            />
            دپارتمان
          </label>
        </div>
        <Select value={assigneeId || "__none__"} onValueChange={(value) => setAssigneeId(value === "__none__" ? "" : value)}>
          <SelectTrigger aria-label="گیرنده">
            <SelectValue placeholder="انتخاب کنید" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">انتخاب کنید</SelectItem>
            {(assigneeKind === "staff" ? staff : departments).map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {"fullName" in item ? item.fullName : item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>دسته</Label>
          <Select
            value={categoryId || "__none__"}
            onValueChange={(value) => setCategoryId(value === "__none__" ? "" : value)}
          >
            <SelectTrigger aria-label="دسته">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>اولویت</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger aria-label="اولویت">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(fa.priority) as Array<keyof typeof fa.priority>).map((key) => (
                <SelectItem key={key} value={key}>
                  {fa.priority[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">نحوه تکمیل</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="completionMode"
            value="INDIVIDUAL"
            checked={completionMode === "INDIVIDUAL"}
            onChange={() => setCompletionMode("INDIVIDUAL")}
          />
          فردی
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="completionMode"
            value="SHARED"
            checked={completionMode === "SHARED"}
            onChange={() => setCompletionMode("SHARED")}
          />
          مشترک
        </label>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="dueTime">مهلت روزانه (HH:mm)</Label>
        <Input id="dueTime" name="dueTime" dir="ltr" className="text-start" placeholder="14:00" disabled={pending} />
      </div>

      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? fa.common.loading : fa.common.bulkAddTasks}
      </Button>
    </form>
  );
}
