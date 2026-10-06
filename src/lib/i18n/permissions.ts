import type { Permission } from "@/db/schema";

/** برچسب کوتاه فارسی مجوزها */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "tasks.create": "ایجاد کار",
  "tasks.assign": "تخصیص کار",
  "staff.manage": "مدیریت پرسنل",
  "reports.view_all": "گزارش همه",
  "reports.view_department": "گزارش دپارتمان",
  "reports.export": "خروجی گزارش",
  "announcements.manage": "مدیریت اطلاعیه",
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "tasks.create": "تعریف الگوی کار جدید",
  "tasks.assign": "اساین کار به پرسنل و تغییر وضعیت بورد",
  "staff.manage": "ایجاد و ویرایش حساب پرسنل",
  "reports.view_all": "مشاهده گزارش همه دپارتمان‌ها",
  "reports.view_department": "مشاهده گزارش دپارتمان خود",
  "reports.export": "خروجی CSV/Excel گزارش‌ها",
  "announcements.manage": "انتشار و حذف اطلاعیه",
};
