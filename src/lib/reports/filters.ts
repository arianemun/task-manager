import type { Priority, RecurrenceType } from "@/db/schema";
import {
  resolveReportRange,
  type RangeShortcut,
} from "./range";
import type { GDate } from "@/lib/dates";

export type ReportFilters = {
  shortcut: RangeShortcut;
  from: GDate;
  to: GDate;
  departmentId: number | null;
  userId: number | null;
  categoryId: number | null;
  recurrenceType: RecurrenceType | null;
  priority: Priority | null;
  q: string;
  tab: string;
  granularity: "day" | "week" | "month";
  staffSort: "rate_desc" | "rate_asc" | "name";
  page: number;
  pageSize: number;
};

export function parseReportFilters(
  sp: Record<string, string | string[] | undefined>,
): ReportFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const shortcut = (get("range") || "month") as RangeShortcut;
  const allowed: RangeShortcut[] = [
    "today",
    "week",
    "month",
    "last_month",
    "last_3_months",
    "custom",
  ];
  const sc = allowed.includes(shortcut) ? shortcut : "month";
  const { from, to } = resolveReportRange(sc, get("from"), get("to"));

  const num = (k: string) => {
    const n = Number(get(k));
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  const gran = get("g") as "day" | "week" | "month" | undefined;
  const staffSort = (get("staffSort") || "rate_desc") as ReportFilters["staffSort"];

  const recurrenceWhitelist: RecurrenceType[] = [
    "ONCE",
    "DAILY",
    "WEEKLY",
    "MONTHLY",
    "CUSTOM",
  ];
  const priorityWhitelist: Priority[] = ["LOW", "MEDIUM", "HIGH"];
  const rt = get("recurrenceType") as RecurrenceType | undefined;
  const pr = get("priority") as Priority | undefined;

  return {
    shortcut: sc,
    from,
    to,
    departmentId: num("departmentId"),
    userId: num("userId"),
    categoryId: num("categoryId"),
    recurrenceType: rt && recurrenceWhitelist.includes(rt) ? rt : null,
    priority: pr && priorityWhitelist.includes(pr) ? pr : null,
    q: (get("q") || "").trim().slice(0, 200),
    tab: get("tab") || "summary",
    granularity: gran === "week" || gran === "month" || gran === "day" ? gran : "day",
    staffSort:
      staffSort === "rate_asc" || staffSort === "name" ? staffSort : "rate_desc",
    page: Math.max(1, Number(get("page")) || 1),
    pageSize: Math.min(100, Math.max(10, Number(get("pageSize")) || 25)),
  };
}

export function filtersToSearchParams(
  f: Partial<ReportFilters> & { from: GDate; to: GDate },
  base?: ReportFilters,
): URLSearchParams {
  const merged = { ...base, ...f } as ReportFilters;
  const p = new URLSearchParams();
  p.set("range", merged.shortcut);
  if (merged.shortcut === "custom") {
    p.set("from", merged.from);
    p.set("to", merged.to);
  }
  if (merged.departmentId) p.set("departmentId", String(merged.departmentId));
  if (merged.userId) p.set("userId", String(merged.userId));
  if (merged.categoryId) p.set("categoryId", String(merged.categoryId));
  if (merged.recurrenceType) p.set("recurrenceType", merged.recurrenceType);
  if (merged.priority) p.set("priority", merged.priority);
  if (merged.q) p.set("q", merged.q);
  if (merged.tab) p.set("tab", merged.tab);
  if (merged.granularity) p.set("g", merged.granularity);
  if (merged.staffSort && merged.staffSort !== "rate_desc") {
    p.set("staffSort", merged.staffSort);
  }
  if (merged.page > 1) p.set("page", String(merged.page));
  return p;
}
