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
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/server/actions/auth";
import { createStaffNoteAction } from "@/server/actions/notes";

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  body: z.string().min(1, "متن الزامی است"),
});

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function NoteForm({ userId }: { userId: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createStaffNoteAction, initial);
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", body: "" },
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
        className="space-y-3"
        onSubmit={form.handleSubmit((values) => {
          const fd = new FormData();
          fd.set("userId", String(userId));
          fd.set("title", values.title);
          fd.set("body", values.body);
          start(() => action(fd));
        })}
      >
        <FormField
          control={form.control}
          name="title"
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
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>متن</FormLabel>
              <FormControl>
                <Textarea {...field} disabled={pending} rows={4} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {state && !state.ok ? (
          <p className="text-destructive text-sm">{state.error}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          ثبت یادداشت
        </Button>
      </form>
    </Form>
  );
}
