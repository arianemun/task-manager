"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DepartmentChips } from "@/components/reasons/department-chips";
import { Button } from "@/components/ui/button";
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
import { createReasonAction } from "@/server/actions/reasons";

const schema = z.object({
  label: z.string().trim().min(2, "عنوان دلیل حداقل ۲ حرف باشد").max(80),
  departmentIds: z.array(z.number()),
});

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function ReasonCreateForm({
  departments,
}: {
  departments: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createReasonAction, initial);
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", departmentIds: [] },
  });

  useEffect(() => {
    if (state?.ok) {
      form.reset({ label: "", departmentIds: [] });
      router.refresh();
    }
  }, [state, router, form]);

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          const fd = new FormData();
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
        <Button type="submit" disabled={pending}>
          افزودن
        </Button>
        {state && !state.ok ? (
          <p className="text-destructive text-sm">{state.error}</p>
        ) : null}
      </form>
    </Form>
  );
}
