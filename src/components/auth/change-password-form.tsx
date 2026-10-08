"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  changePasswordAction,
  type ActionResult,
} from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { fa } from "@/lib/i18n/fa";

const schema = z
  .object({
    currentPassword: z.string().min(1, "رمز فعلی الزامی است"),
    newPassword: z.string().min(8, "رمز جدید حداقل ۸ کاراکتر"),
    confirmPassword: z.string().min(1, "تکرار رمز الزامی است"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "تکرار رمز مطابقت ندارد",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;
const initial: ActionResult | null = null;

export function ChangePasswordForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initial,
  );
  const [, start] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          const fd = new FormData();
          fd.set("currentPassword", values.currentPassword);
          fd.set("newPassword", values.newPassword);
          fd.set("confirmPassword", values.confirmPassword);
          start(() => formAction(fd));
        })}
      >
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.auth.currentPassword}</FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  autoComplete="current-password"
                  disabled={pending}
                  dir="ltr"
                  className="text-start"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.auth.newPassword}</FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  disabled={pending}
                  dir="ltr"
                  className="text-start"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{fa.auth.confirmPassword}</FormLabel>
              <FormControl>
                <PasswordInput
                  {...field}
                  autoComplete="new-password"
                  disabled={pending}
                  dir="ltr"
                  className="text-start"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {state && !state.ok ? (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
          >
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? fa.common.loading : fa.auth.changePassword}
        </Button>
      </form>
    </Form>
  );
}
