"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PasswordRevealDialog } from "@/components/staff/password-reveal-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PERMISSIONS, type Permission, type Role } from "@/db/schema";
import { fa } from "@/lib/i18n/fa";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
} from "@/lib/i18n/permissions";
import {
  fullNameSchema,
  iranMobileSchema,
  nationalCodeSchema,
  usernameSchema,
} from "@/lib/validation/iran";
import type { ActionResult } from "@/server/actions/auth";
import {
  createStaffAction,
  updateStaffAction,
} from "@/server/actions/staff";

type Dept = { id: number; name: string };

type Props = {
  mode: "create" | "edit";
  departments: Dept[];
  actorRole: Role;
  initial?: {
    id: number;
    username: string;
    fullName: string;
    nationalCode: string | null;
    phone: string | null;
    email: string | null;
    position: string | null;
    departmentId: number | null;
    role: Role;
    hireDate: string | null;
    permissions: Permission[];
  };
};

const staffFormSchema = z.object({
  username: usernameSchema,
  fullName: fullNameSchema,
  nationalCode: nationalCodeSchema.optional().or(z.literal("")),
  phone: iranMobileSchema.optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("ایمیل معتبر نیست")
    .optional()
    .or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
  departmentId: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]),
  hireDate: z.string().trim().optional().or(z.literal("")),
  permissions: z.array(z.string()),
});

type StaffFormValues = z.infer<typeof staffFormSchema>;

const initialState: ActionResult | null = null;

export function StaffForm({ mode, departments, actorRole, initial }: Props) {
  const router = useRouter();
  const action = mode === "create" ? createStaffAction : updateStaffAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [password, setPassword] = useState<string | null>(null);

  const canPickRole = actorRole === "ADMIN";
  const canPickDept = actorRole === "ADMIN";
  const canSetPermissions = actorRole === "ADMIN" && mode === "create";

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      username: initial?.username ?? "",
      fullName: initial?.fullName ?? "",
      nationalCode: initial?.nationalCode ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      position: initial?.position ?? "",
      departmentId: initial?.departmentId
        ? String(initial.departmentId)
        : canPickDept
          ? ""
          : String(departments[0]?.id ?? ""),
      role: initial?.role ?? "STAFF",
      hireDate: initial?.hireDate ?? "",
      permissions: initial?.permissions ?? [],
    },
  });

  useEffect(() => {
    if (!state?.ok) return;
    if (state.generatedPassword) {
      setPassword(state.generatedPassword);
      return;
    }
    if (mode === "edit" && initial) {
      router.push(`/admin/staff/${initial.id}`);
    } else {
      router.push("/admin/staff");
    }
    router.refresh();
  }, [state, mode, initial, router]);

  function onSubmit(values: StaffFormValues) {
    const fd = new FormData();
    if (mode === "edit" && initial) fd.set("id", String(initial.id));
    fd.set("username", values.username);
    fd.set("fullName", values.fullName);
    fd.set("nationalCode", values.nationalCode ?? "");
    fd.set("phone", values.phone ?? "");
    fd.set("email", values.email ?? "");
    fd.set("position", values.position ?? "");
    fd.set(
      "departmentId",
      canPickDept
        ? values.departmentId || ""
        : String(departments[0]?.id ?? ""),
    );
    fd.set("role", canPickRole ? values.role : "STAFF");
    fd.set("hireDate", values.hireDate ?? "");
    if (canSetPermissions) {
      for (const p of values.permissions) {
        fd.append("permissions", p);
      }
    }
    formAction(fd);
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">اطلاعات فردی</CardTitle>
              <CardDescription>نام، تماس و شناسه</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{fa.auth.username}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        className="text-start"
                        disabled={mode === "edit" || pending}
                        pattern="[A-Za-z0-9._]+"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام کامل</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={pending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nationalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>کد ملی</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        className="text-start"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>موبایل</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        className="text-start"
                        placeholder="09xxxxxxxxx"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ایمیل</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        dir="ltr"
                        className="text-start"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">اطلاعات شغلی</CardTitle>
              <CardDescription>سمت، دپارتمان و تاریخ استخدام</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>سمت</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={pending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {canPickDept ? (
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>دپارتمان</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(v) =>
                          field.onChange(v === "__none__" ? "" : v)
                        }
                        disabled={pending}
                      >
                        <FormControl>
                          <SelectTrigger aria-label="دپارتمان">
                            <SelectValue placeholder="انتخاب دپارتمان" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
              <FormField
                control={form.control}
                name="hireDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاریخ استخدام (میلادی YYYY-MM-DD)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        className="text-start"
                        placeholder="2026-03-21"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">حساب و دسترسی</CardTitle>
              <CardDescription>نقش و مجوزهای اضافی</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canPickRole ? (
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>نقش</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={pending}
                      >
                        <FormControl>
                          <SelectTrigger aria-label="نقش">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="STAFF">{fa.roles.STAFF}</SelectItem>
                          <SelectItem value="MANAGER">
                            {fa.roles.MANAGER}
                          </SelectItem>
                          <SelectItem value="ADMIN">{fa.roles.ADMIN}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {canSetPermissions ? (
                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>مجوزهای اضافی</FormLabel>
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
                            </div>
                          );
                        })}
                      </div>
                      <FormDescription>
                        فقط برای حساب‌های جدید در این فرم
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </CardContent>
          </Card>

          {state && !state.ok ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
            >
              {state.error}
            </p>
          ) : null}

          <div className="bg-background/95 sticky bottom-0 z-10 flex gap-2 border-t py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
            <Button type="submit" disabled={pending} className="min-h-11 flex-1 md:flex-none">
              {pending ? fa.common.loading : fa.common.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={pending}
              className="min-h-11"
            >
              {fa.common.cancel}
            </Button>
          </div>
        </form>
      </Form>

      <PasswordRevealDialog
        password={password}
        onClose={() => {
          setPassword(null);
          router.push("/admin/staff");
          router.refresh();
        }}
        title="رمز اولیه پرسنل"
      />
    </>
  );
}
