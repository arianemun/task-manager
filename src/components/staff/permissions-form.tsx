"use client";

import { useActionState, useEffect } from "react";
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
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { PERMISSIONS, type Permission } from "@/db/schema";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
} from "@/lib/i18n/permissions";
import type { ActionResult } from "@/server/actions/auth";
import { setStaffPermissionsAction } from "@/server/actions/staff";

const schema = z.object({
  permissions: z.array(z.string()),
});

type Values = z.infer<typeof schema>;

const initial: ActionResult | null = null;

export function PermissionsForm({
  userId,
  permissions,
}: {
  userId: number;
  permissions: Permission[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    setStaffPermissionsAction,
    initial,
  );

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { permissions },
  });

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  function onSubmit(values: Values) {
    const fd = new FormData();
    fd.set("id", String(userId));
    for (const p of values.permissions) {
      fd.append("permissions", p);
    }
    action(fd);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="permissions"
          render={({ field }) => (
            <FormItem>
              <div className="grid gap-3 sm:grid-cols-2">
                {PERMISSIONS.map((p) => {
                  const on = field.value.includes(p);
                  return (
                    <div
                      key={p}
                      className="flex items-start justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">
                          {PERMISSION_LABELS[p]}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {PERMISSION_DESCRIPTIONS[p]}
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={on}
                          disabled={pending}
                          onCheckedChange={(checked) => {
                            field.onChange(
                              checked
                                ? [...field.value, p]
                                : field.value.filter((x) => x !== p),
                            );
                          }}
                          aria-label={PERMISSION_LABELS[p]}
                        />
                      </FormControl>
                    </div>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {state && !state.ok ? (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        ) : null}
        <div className="bg-background/95 sticky bottom-0 z-10 border-t py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
          <Button type="submit" disabled={pending} className="min-h-11 w-full md:w-auto">
            ذخیره مجوزها
          </Button>
        </div>
      </form>
    </Form>
  );
}
