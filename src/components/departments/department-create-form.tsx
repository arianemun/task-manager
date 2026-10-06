"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { createDepartmentAction } from "@/server/actions/departments";

const schema = z.object({
  name: z.string().min(1, "نام الزامی است"),
});

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function DepartmentCreateForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createDepartmentAction, initial);
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (state?.ok) {
      form.reset();
      router.refresh();
    }
  }, [state, router, form]);

  return (
    <Form {...form}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={form.handleSubmit((values) => {
          const fd = new FormData();
          fd.set("name", values.name);
          start(() => action(fd));
        })}
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
        <Button type="submit" disabled={pending}>
          ایجاد
        </Button>
        {state && !state.ok ? (
          <p className="text-destructive w-full text-sm">{state.error}</p>
        ) : null}
      </form>
    </Form>
  );
}
