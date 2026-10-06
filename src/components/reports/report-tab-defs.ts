export const REPORT_TABS = [
  { id: "summary", label: "خلاصه" },
  { id: "staff", label: "پرسنل" },
  { id: "departments", label: "دپارتمان‌ها" },
  { id: "tasks", label: "کارها" },
  { id: "patterns", label: "الگوها" },
  { id: "reasons", label: "دلایل" },
  { id: "details", label: "جزئیات" },
] as const;

export type ReportTabId = (typeof REPORT_TABS)[number]["id"];
