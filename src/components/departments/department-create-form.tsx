"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { fa } from "@/lib/i18n/fa";
import { useSubmitLock } from "@/lib/ui/submit-lock";
import { createDepartmentAction } from "@/server/actions/departments";

const schema = z.object({
  name: z.string().min(1, "نام الزامی است"),
});

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function DepartmentCreateForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createDepartmentAction, initial);
  const { guard, release, bind } = useSubmitLock(pending);
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.error || fa.common.saveFailed);
      return;
    }
    toast.success(fa.common.departmentCreated);
    form.reset();
    router.refresh();
  }, [state, router, form]);

  return (
    <Form {...form}>
      <form
        ref={bind}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          if (guard(event)) return;
          void form.handleSubmit((values) => {
            const fd = new FormData();
            fd.set("name", values.name);
            start(() => action(fd));
          }, () => release())(event);
        }}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>نام</FormLabel>
              <FormControl>
                <Input {...field} disabled={pending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? fa.common.loading : "ایجاد"}
        </Button>
        {state && !state.ok ? (
          <p className="text-destructive w-full text-sm">{state.error}</p>
        ) : null}
      </form>
    </Form>
  );
}
