"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { updateCategoryAction } from "@/server/actions/categories";

const schema = z.object({
  name: z.string().trim().min(2, "نام دسته حداقل ۲ حرف باشد").max(80),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "رنگ باید به صورت #RRGGBB باشد"),
});

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function CategoryEditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: { id: number; name: string; color: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateCategoryAction, initial);
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: row.name, color: row.color },
  });

  useEffect(() => {
    if (open) form.reset({ name: row.name, color: row.color });
  }, [open, row.name, row.color, form]);

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
          <DialogTitle>ویرایش دسته</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => {
              const fd = new FormData();
              fd.set("id", String(row.id));
              fd.set("name", values.name);
              fd.set("color", values.color);
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
                        className="w-32 font-mono"
                      />
                    </div>
                  </FormControl>
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
