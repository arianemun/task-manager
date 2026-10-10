import { z } from "zod";
import { PRIORITIES } from "@/db/schema";
import { normalizeTaskPriority } from "@/lib/tasks/priority";

const gDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ نامعتبر است");
const weekday = z.number().int().min(0).max(6);

export const onceConfigSchema = z.object({
  date: gDate,
});

export const dailyConfigSchema = z.object({
  interval: z.coerce.number().int().min(1).default(1),
  excludeWeekdays: z.array(weekday).default([]),
});

export const weeklyConfigSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("specific_days"),
    weekdays: z.array(weekday).min(1, "حداقل یک روز هفته انتخاب کنید"),
  }),
  z.object({
    mode: z.literal("any_day_in_week"),
  }),
]);

export const monthlyConfigSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("day_of_month"),
    day: z.coerce.number().int().min(1).max(31),
  }),
  z.object({ mode: z.literal("last_day") }),
  z.object({ mode: z.literal("any_day_in_month") }),
]);

export const customConfigSchema = z.object({
  unit: z.enum(["day", "week", "month"]),
  interval: z.coerce.number().int().min(1),
  weekdays: z.array(weekday).optional(),
  day: z.coerce.number().int().min(1).max(31).optional(),
});

export const taskRecurrenceSchema = z.discriminatedUnion("recurrenceType", [
  z.object({
    recurrenceType: z.literal("ONCE"),
    recurrenceConfig: onceConfigSchema,
  }),
  z.object({
    recurrenceType: z.literal("DAILY"),
    recurrenceConfig: dailyConfigSchema,
  }),
  z.object({
    recurrenceType: z.literal("WEEKLY"),
    recurrenceConfig: weeklyConfigSchema,
  }),
  z.object({
    recurrenceType: z.literal("MONTHLY"),
    recurrenceConfig: monthlyConfigSchema,
  }),
  z.object({
    recurrenceType: z.literal("CUSTOM"),
    recurrenceConfig: customConfigSchema.superRefine((c, ctx) => {
      if (c.unit === "week" && (!c.weekdays || c.weekdays.length === 0)) {
        ctx.addIssue({
          code: "custom",
          message: "حداقل یک روز هفته برای الگوی سفارشی هفتگی لازم است",
          path: ["weekdays"],
        });
      }
    }),
  }),
]);

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "عنوان الزامی است").max(200),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    categoryId: z.coerce.number().int().positive().nullable().optional(),
    priority: z.preprocess(normalizeTaskPriority, z.enum(PRIORITIES)),
    requiresNote: z.boolean().default(false),
    requiresAttachment: z.boolean().default(false),
    skipHolidays: z.boolean().default(true),
    completionMode: z.enum(["INDIVIDUAL", "SHARED"]).default("INDIVIDUAL"),
    startDate: gDate,
    endDate: gDate.nullable().optional(),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional()
      .or(z.literal("")),
    dueTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional()
      .or(z.literal("")),
    userIds: z.array(z.coerce.number().int().positive()).default([]),
    departmentIds: z.array(z.coerce.number().int().positive()).default([]),
  })
  .and(taskRecurrenceSchema)
  .superRefine((data, ctx) => {
    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "تاریخ پایان نمی‌تواند قبل از شروع باشد",
        path: ["endDate"],
      });
    }
    if (data.userIds.length === 0 && data.departmentIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "حداقل یک گیرنده (پرسنل یا دپارتمان) لازم است",
        path: ["userIds"],
      });
    }
  });

export type TaskFormInput = z.infer<typeof taskFormSchema>;
