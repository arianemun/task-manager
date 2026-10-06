"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DepartmentChips } from "@/components/reasons/department-chips";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/server/actions/auth";
import { updateReasonAction } from "@/server/actions/reasons";

const schema = z.object({
  label: z.string().trim().min(2, "عنوان دلیل حداقل ۲ حرف باشد").max(80),
  departmentIds: z.array(z.number()),
});

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function ReasonEditDialog({
  row,
  departments,
  open,
  onOpenChange,
}: {
  row: { id: number; label: string; departmentIds: number[] };
  departments: Array<{ id: number; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateReasonAction, initial);
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { label: row.label, departmentIds: row.departmentIds },
  });

  const departmentKey = row.departmentIds.join(",");
  useEffect(() => {
    if (open) {
      form.reset({
        label: row.label,
        departmentIds: departmentKey
          ? departmentKey.split(",").map(Number)
          : [],
      });
    }
  }, [open, row.label, departmentKey, form]);

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, router, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ویرایش دلیل</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              const fd = new FormData();
              fd.set("id", String(row.id));
              fd.set("label", values.label);
              fd.set("departmentIds", JSON.stringify(values.departmentIds));
              start(() => action(fd));
            })}
          >
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={pending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departmentIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>دپارتمان‌ها</FormLabel>
                  <DepartmentChips
                    departments={departments}
                    selected={field.value}
                    onChange={field.onChange}
                    disabled={pending}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            {state && !state.ok ? (
              <p className="text-destructive text-sm">{state.error}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={pending}>
                ذخیره
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
