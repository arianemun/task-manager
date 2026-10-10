"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fa } from "@/lib/i18n/fa";
import { previewTaskNotifyAction, sendTaskNotifyAction } from "@/server/actions/task-notify-lab";

const TYPES = [
  "task.assigned",
  "task.daily_digest",
  "task.due_soon",
  "task.overdue",
  "task.manager_summary",
] as const;

type Plan = {
  willSend: boolean;
  reason: string;
  title: string;
  body: string;
  type: string;
};

export function TaskNotifyLab({
  users,
}: {
  users: Array<{ id: number; fullName: string; role: string }>;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);

  async function run(formData: FormData, send: boolean) {
    setBusy(true);
    try {
      const result = send
        ? await sendTaskNotifyAction(formData)
        : await previewTaskNotifyAction(formData);
      setPlans(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{fa.taskNotify.labTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const send = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "send";
            void run(data, send);
          }}
        >
          <label className="flex min-h-11 flex-wrap items-center gap-3">
            {fa.taskNotify.type}
            <select name="type" className="border-input bg-background h-11 rounded-md border px-2">
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {fa.notifications.types[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 flex-wrap items-center gap-3">
            {fa.taskNotify.user}
            <select name="userId" className="border-input bg-background h-11 rounded-md border px-2">
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.role})
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="intent" value="preview" variant="outline" disabled={busy}>
              {fa.taskNotify.preview}
            </Button>
            <Button type="submit" name="intent" value="send" disabled={busy}>
              {fa.taskNotify.send}
            </Button>
          </div>
        </form>
        {plans.length > 0 ? (
          <ul className="space-y-3">
            {plans.map((plan, index) => (
              <li key={`${plan.type}-${index}`} className="rounded-md border p-3">
                <p>{plan.willSend ? fa.taskNotify.willSend : fa.taskNotify.willNotSend}</p>
                <p className="text-muted-foreground">{plan.reason}</p>
                {plan.title ? <p className="font-medium">{plan.title}</p> : null}
                {plan.body ? <p className="whitespace-pre-wrap">{plan.body}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
