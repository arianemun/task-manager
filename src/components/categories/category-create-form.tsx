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
import { createCategoryAction } from "@/server/actions/categories";

const schema = z.object({
  name: z.string().trim().min(2, "نام دسته حداقل ۲ حرف باشد").max(80),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "رنگ باید به صورت #RRGGBB باشد"),
});

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function CategoryCreateForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createCategoryAction, initial);
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", color: "#64748b" },
  });

  useEffect(() => {
    if (state?.ok) {
      form.reset({ name: "", color: "#64748b" });
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
          fd.set("color", values.color);
          start(() => action(fd));
        })}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="min-w-48 flex-1">
              <FormLabel>نام</FormLabel>
              <FormControl>
                <Input {...field} disabled={pending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>رنگ</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={field.value}
                    disabled={pending}
                    className="h-10 w-14 cursor-pointer p-1"
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-label="انتخاب رنگ"
                  />
                  <Input
                    {...field}
                    dir="ltr"
                    disabled={pending}
                    className="w-28 font-mono"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          افزودن
        </Button>
        {state && !state.ok ? (
          <p className="text-destructive w-full text-sm">{state.error}</p>
        ) : null}
      </form>
    </Form>
  );
}
