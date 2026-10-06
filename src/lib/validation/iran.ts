import { z } from "zod";
import { normalizeInputDigits, normalizePersianText } from "./normalize";

const USERNAME_RE = /^[a-zA-Z0-9._]+$/;
const IR_MOBILE_RE = /^09\d{9}$/;

export function isValidIranianNationalCode(code: string): boolean {
  const n = normalizeInputDigits(code);
  if (!/^\d{10}$/.test(n)) return false;
  if (/^(\d)\1{9}$/.test(n)) return false;

  const check = Number(n[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(n[i]) * (10 - i);
  }
  const r = sum % 11;
  return r < 2 ? check === r : check === 11 - r;
}

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "نام کاربری حداقل ۳ کاراکتر باشد")
  .max(64, "نام کاربری خیلی طولانی است")
  .regex(
    USERNAME_RE,
    "نام کاربری فقط حروف لاتین، عدد، نقطه و زیرخط مجاز است",
  );

export const iranMobileSchema = z
  .string()
  .trim()
  .transform(normalizeInputDigits)
  .refine((v) => v === "" || IR_MOBILE_RE.test(v), {
    message: "شماره موبایل باید به فرم 09xxxxxxxxx باشد",
  });

export const nationalCodeSchema = z
  .string()
  .trim()
  .transform(normalizeInputDigits)
  .refine((v) => v === "" || isValidIranianNationalCode(v), {
    message: "کد ملی معتبر نیست",
  });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "نام کامل الزامی است")
  .max(120)
  .transform((v) => v.trim());

export function staffFormBaseSchema() {
  return z.object({
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
    departmentId: z.coerce.number().int().positive().nullable().optional(),
    role: z.enum(["ADMIN", "MANAGER", "STAFF"]),
    hireDate: z.string().trim().optional().or(z.literal("")),
  });
}

export function toSearchNeedle(query: string): string {
  return normalizePersianText(query);
}
